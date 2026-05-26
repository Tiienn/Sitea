/* global process, Buffer */
import { randomUUID } from 'node:crypto';
import { HttpError, upsertVerifiedSubscription } from './subscriptions.js';

export const ONE_TIME_PLANS = {
  homeowner: {
    price: '20.00',
    currency: 'USD',
    description: 'Sitea Pro - Homeowner Access',
    expiresAt: null,
  },
  lifetime: {
    price: '149.00',
    currency: 'USD',
    description: 'Sitea Pro - Lifetime Access',
    expiresAt: null,
  },
};

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function getPayPalClientId() {
  return process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID;
}

function getPayPalMonthlyPlanId() {
  return process.env.PAYPAL_MONTHLY_PLAN_ID || process.env.VITE_PAYPAL_MONTHLY_PLAN_ID;
}

function requiredPayPalEnv(name, value) {
  if (!value) throw new HttpError(500, `Missing server environment variable: ${name}`);
  return value;
}

function amountToCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function getOneTimePlan(planType) {
  const plan = ONE_TIME_PLANS[planType];
  if (!plan) throw new HttpError(400, 'Unsupported one-time plan');
  return plan;
}

export async function getPayPalAccessToken() {
  const clientId = requiredPayPalEnv('PAYPAL_CLIENT_ID', getPayPalClientId());
  const clientSecret = requiredPayPalEnv('PAYPAL_CLIENT_SECRET', process.env.PAYPAL_CLIENT_SECRET);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error('PayPal OAuth failed:', data);
    throw new HttpError(502, 'Could not connect to PayPal');
  }

  return data.access_token;
}

export async function paypalRequest(path, options = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('PayPal API error:', response.status, data);
    throw new HttpError(502, 'PayPal verification failed');
  }

  return data;
}

export async function createOneTimeOrder({ user, planType }) {
  const plan = getOneTimePlan(planType);
  const order = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'PayPal-Request-Id': randomUUID(),
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: planType,
          custom_id: `${user.id}:${planType}`,
          description: plan.description,
          amount: {
            currency_code: plan.currency,
            value: plan.price,
          },
        },
      ],
      application_context: {
        brand_name: 'Sitea',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!order.id) throw new HttpError(502, 'PayPal did not return an order ID');
  return order;
}

export async function captureAndSaveOneTimeOrder({ user, orderId, planType }) {
  const plan = getOneTimePlan(planType);
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpError(400, 'PayPal order ID is required');
  }

  const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      'PayPal-Request-Id': randomUUID(),
    },
  });

  const capture = order.purchase_units
    ?.flatMap(unit => unit.payments?.captures || [])
    ?.find(item => item.status === 'COMPLETED');

  const amount = capture?.amount;
  const expectedCents = amountToCents(plan.price);
  const capturedCents = amountToCents(amount?.value);

  if (order.status !== 'COMPLETED' || !capture) {
    throw new HttpError(400, 'PayPal order was not completed');
  }
  if (amount?.currency_code !== plan.currency || capturedCents !== expectedCents) {
    throw new HttpError(400, 'PayPal order amount did not match the selected plan');
  }

  await upsertVerifiedSubscription({
    user,
    planType,
    paypalOrderId: order.id,
    paypalPayerId: order.payer?.payer_id || null,
    paypalStatus: order.status,
    expiresAt: plan.expiresAt,
  });

  return order;
}

export async function verifyAndSaveMonthlySubscription({ user, subscriptionId }) {
  const expectedPlanId = requiredPayPalEnv('PAYPAL_MONTHLY_PLAN_ID', getPayPalMonthlyPlanId());
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    throw new HttpError(400, 'PayPal subscription ID is required');
  }

  const subscription = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'GET',
  });

  if (subscription.status !== 'ACTIVE') {
    throw new HttpError(400, 'PayPal subscription is not active');
  }
  if (subscription.plan_id !== expectedPlanId) {
    throw new HttpError(400, 'PayPal subscription plan did not match');
  }

  const nextBillingTime = subscription.billing_info?.next_billing_time || null;
  const fallbackExpiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();

  await upsertVerifiedSubscription({
    user,
    planType: 'monthly',
    paypalSubscriptionId: subscription.id,
    paypalPayerId: subscription.subscriber?.payer_id || null,
    paypalPlanId: subscription.plan_id,
    paypalStatus: subscription.status,
    expiresAt: nextBillingTime || fallbackExpiresAt,
  });

  return subscription;
}
