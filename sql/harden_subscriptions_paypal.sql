-- Harden subscriptions for server-verified PayPal entitlements.
-- Apply after setting SUPABASE_SERVICE_ROLE_KEY on Vercel.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paypal',
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_status TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_email_unique ON subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_order_id ON subscriptions(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_subscription_id ON subscriptions(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_payer_id ON subscriptions(paypal_payer_id);

GRANT SELECT ON subscriptions TO authenticated;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Server can manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Allow public insert" ON subscriptions;
DROP POLICY IF EXISTS "Allow public read access" ON subscriptions;
DROP POLICY IF EXISTS "Allow public update" ON subscriptions;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Subscription inserts/updates are performed by the Vercel API with the
-- Supabase service-role key, which bypasses RLS. Do not add public insert or
-- update policies for this table.
