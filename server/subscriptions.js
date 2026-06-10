import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(500, `Missing server environment variable: ${name}`);
  return value;
}

export function getSupabaseUrl() {
  return requiredEnv('VITE_SUPABASE_URL');
}

export function getSupabaseAnonKey() {
  return requiredEnv('VITE_SUPABASE_ANON_KEY');
}

export function getSupabaseServiceRoleKey() {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required');
  }
  return authHeader.replace('Bearer ', '');
}

async function getUserFromToken(token) {
  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    throw new HttpError(401, 'Invalid or expired token');
  }

  return user;
}

export async function getAuthenticatedUser(req) {
  return getUserFromToken(getBearerToken(req));
}

export function isSubscriptionActive(subscription) {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.expires_at) return true;
  return new Date(subscription.expires_at) >= new Date();
}

export async function requireActiveSubscription(req) {
  if (
    process.env.SITEA_QA_BYPASS_SUBSCRIPTION === '1' &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV &&
    req.headers['x-sitea-qa-bypass'] === 'local-fixture-runner'
  ) {
    return {
      user: { id: 'local-floor-plan-qa', email: 'floor-plan-qa@sitea.local' },
      subscription: { status: 'active', plan_type: 'qa', expires_at: null },
    };
  }

  const token = getBearerToken(req);
  const user = await getUserFromToken(token);
  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan_type, expires_at')
    .eq('email', user.email.toLowerCase())
    .eq('status', 'active')
    .maybeSingle();

  if (!isSubscriptionActive(subscription)) {
    throw new HttpError(403, 'Active subscription required');
  }

  return { user, subscription };
}

export async function upsertVerifiedSubscription({
  user,
  planType,
  paypalSubscriptionId = null,
  paypalOrderId = null,
  paypalPayerId = null,
  paypalPlanId = null,
  paypalStatus = 'COMPLETED',
  expiresAt = null,
}) {
  const supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
  const email = user.email.toLowerCase();

  const fullPayload = {
    email,
    user_id: user.id,
    paypal_subscription_id: paypalSubscriptionId,
    paypal_order_id: paypalOrderId,
    paypal_payer_id: paypalPayerId,
    paypal_plan_id: paypalPlanId,
    paypal_status: paypalStatus,
    provider: 'paypal',
    status: 'active',
    plan_type: planType,
    expires_at: expiresAt,
    verified_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('subscriptions')
    .upsert(fullPayload, { onConflict: 'email' });

  if (!error) return;

  // Keep compatibility with the older table shape documented in PRD.md.
  const legacyPayload = {
    email,
    paypal_subscription_id: paypalSubscriptionId,
    paypal_payer_id: paypalPayerId,
    status: 'active',
    plan_type: planType,
    expires_at: expiresAt,
  };

  const { error: legacyError } = await supabase
    .from('subscriptions')
    .upsert(legacyPayload, { onConflict: 'email' });

  if (legacyError) {
    console.error('Subscription upsert failed:', legacyError);
    throw new HttpError(500, 'Could not save verified subscription');
  }
}

export function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : 'Unexpected server error';
  if (!(error instanceof HttpError)) console.error(error);
  return res.status(status).json({ error: message });
}
