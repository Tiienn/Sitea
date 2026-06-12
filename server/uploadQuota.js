import { createClient } from '@supabase/supabase-js';
import {
  getAuthenticatedUser,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  HttpError,
  isSubscriptionActive,
} from './subscriptions.js';

// Launch promo: raised from 1 while Pro is free for everyone (see FREE_LAUNCH
// in src/hooks/useUser.jsx). Per-user cap stays so AI analysis costs are bounded.
const FREE_UPLOAD_LIMIT = 20;
const MONTHLY_UPLOAD_LIMIT = 3;
const HOMEOWNER_UPLOAD_LIMIT = 20;
const UNLIMITED_RPC_LIMIT = 2147483647;

function createServiceClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
}

function isQaSubscription(user, subscription) {
  return subscription?.plan_type === 'qa' || user?.id === 'local-floor-plan-qa';
}

function getPlanType(subscription) {
  if (!isSubscriptionActive(subscription)) return null;
  return subscription.plan_type || null;
}

export function getUploadLimitForPlan(planType) {
  if (planType === 'monthly') return MONTHLY_UPLOAD_LIMIT;
  if (planType === 'homeowner') return HOMEOWNER_UPLOAD_LIMIT;
  if (planType === 'lifetime' || planType === 'qa') return Infinity;
  return FREE_UPLOAD_LIMIT;
}

function getUploadPeriodKey(planType) {
  if (planType !== 'monthly') return 'forever';
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `monthly:${year}-${month}`;
}

function toQuotaResponse({ used, limit, planType, periodKey, consumed = false }) {
  const isUnlimited = limit === Infinity;
  return {
    used,
    limit: isUnlimited ? null : limit,
    remaining: isUnlimited ? null : Math.max(0, limit - used),
    isUnlimited,
    planType,
    periodKey,
    consumed,
  };
}

export async function getActiveSubscriptionForUser(user, supabase = createServiceClient()) {
  if (!user?.email) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan_type, expires_at')
    .eq('email', user.email.toLowerCase())
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Upload quota subscription lookup failed:', error);
    throw new HttpError(500, 'Could not load upload quota');
  }

  return isSubscriptionActive(data) ? data : null;
}

export async function getUploadQuotaForUser(user, subscription = undefined) {
  if (isQaSubscription(user, subscription)) {
    return toQuotaResponse({ used: 0, limit: Infinity, planType: 'qa', periodKey: 'forever' });
  }

  const supabase = createServiceClient();
  const activeSubscription =
    subscription === undefined
      ? await getActiveSubscriptionForUser(user, supabase)
      : (isSubscriptionActive(subscription) ? subscription : null);
  const planType = getPlanType(activeSubscription);
  const limit = getUploadLimitForPlan(planType);
  const periodKey = getUploadPeriodKey(planType);

  const { data, error } = await supabase
    .from('upload_usage')
    .select('uploads_used, period_key')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Upload quota lookup failed:', error);
    throw new HttpError(500, 'Could not load upload quota');
  }

  return toQuotaResponse({
    used: data?.period_key === periodKey ? (data?.uploads_used || 0) : 0,
    limit,
    planType,
    periodKey,
  });
}

export async function consumeUploadCreditForUser(user, subscription = undefined) {
  if (isQaSubscription(user, subscription)) {
    return toQuotaResponse({ used: 0, limit: Infinity, planType: 'qa', periodKey: 'forever', consumed: true });
  }

  const supabase = createServiceClient();
  const activeSubscription =
    subscription === undefined
      ? await getActiveSubscriptionForUser(user, supabase)
      : (isSubscriptionActive(subscription) ? subscription : null);
  const planType = getPlanType(activeSubscription);
  const limit = getUploadLimitForPlan(planType);
  const periodKey = getUploadPeriodKey(planType);
  const rpcLimit = limit === Infinity ? UNLIMITED_RPC_LIMIT : limit;

  const { data, error } = await supabase.rpc('consume_upload_credit', {
    p_user_id: user.id,
    p_limit: rpcLimit,
    p_period_key: periodKey,
  });

  if (error) {
    console.error('Upload quota consume failed:', error);
    throw new HttpError(500, 'Could not update upload quota');
  }

  const used = Number(data?.used || 0);
  const allowed = Boolean(data?.allowed);

  if (!allowed) {
    throw new HttpError(403, 'Upload limit reached');
  }

  return toQuotaResponse({
    used,
    limit,
    planType,
    periodKey,
    consumed: true,
  });
}

export async function getUploadQuotaForRequest(req) {
  const user = await getAuthenticatedUser(req);
  return getUploadQuotaForUser(user);
}

export async function consumeUploadCreditForRequest(req) {
  const user = await getAuthenticatedUser(req);
  return consumeUploadCreditForUser(user);
}
