-- Add tracking columns for the one included reading per subscription
-- User gets ONE free personal reading (15-20 min) from their chosen system

ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS included_reading_used BOOLEAN DEFAULT false;

ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS included_reading_system TEXT; -- 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah'

ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS included_reading_job_id UUID;

-- Index for quick checks
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_reading_used 
  ON user_subscriptions(user_id, included_reading_used);
