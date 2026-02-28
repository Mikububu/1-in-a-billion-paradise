-- ============================================================
-- COUPON CODES SYSTEM
-- Allows admins to create discount/free-access codes.
-- Users redeem codes to get subscriptions without App Store payment.
-- ============================================================

-- 1. Coupon definitions
CREATE TABLE IF NOT EXISTS coupon_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 100 CHECK (discount_percent BETWEEN 0 AND 100),
  max_uses    INTEGER,                     -- NULL = unlimited
  times_used  INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,                 -- NULL = never expires
  is_active   BOOLEAN NOT NULL DEFAULT true,
  note        TEXT,                         -- internal note, e.g. "Beta testers batch 1"
  created_by  TEXT,                         -- who created it (email or name)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_codes_upper ON coupon_codes (UPPER(code));

-- 2. Redemption log (who used what)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES coupon_codes(id),
  user_id     UUID,                        -- nullable: redeemed before account creation
  device_id   TEXT,                         -- optional fingerprint to limit abuse
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user   ON coupon_redemptions(user_id);

-- 3. RLS policies
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_coupon_codes" ON coupon_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_coupon_redemptions" ON coupon_redemptions
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read active coupons (for validation)
CREATE POLICY "authenticated_read_coupons" ON coupon_codes
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);
