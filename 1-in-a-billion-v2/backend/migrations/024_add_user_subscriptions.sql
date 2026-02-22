-- Add Stripe-backed subscriptions table for the $9.90/year plan (and future tiers).
-- This table is source-of-truth for entitlement checks and admin visibility.

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- May be NULL for pre-auth purchases; can be linked later after signup.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,

  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT,

  status TEXT NOT NULL, -- 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | etc.
  cancel_at_period_end BOOLEAN DEFAULT false,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON user_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

