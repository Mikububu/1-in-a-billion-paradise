-- Migration 016: Push Notifications System
-- Stores push tokens and job notification subscriptions

-- Table for user push tokens (one per device)
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'expo', -- 'expo', 'apns', 'fcm'
  platform TEXT NOT NULL DEFAULT 'ios', -- 'ios', 'android', 'web'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, push_token)
);

-- Table for job notification subscriptions
CREATE TABLE IF NOT EXISTS job_notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  email TEXT, -- Optional override email
  notified_at TIMESTAMPTZ, -- When notification was sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_job_notifications_job_id ON job_notification_subscriptions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notifications_pending ON job_notification_subscriptions(job_id) 
  WHERE notified_at IS NULL;

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can view own push tokens" ON user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens" ON user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" ON user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens" ON user_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Users can manage their own notification subscriptions
CREATE POLICY "Users can view own notification subs" ON job_notification_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification subs" ON job_notification_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification subs" ON job_notification_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can update notified_at (for backend workers)
CREATE POLICY "Service role can update notifications" ON job_notification_subscriptions
  FOR UPDATE USING (true);

-- Function to get pending notifications for a completed job
CREATE OR REPLACE FUNCTION get_pending_notifications(p_job_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  push_enabled BOOLEAN,
  email_enabled BOOLEAN,
  email TEXT,
  push_tokens TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jns.id AS subscription_id,
    jns.user_id,
    jns.push_enabled,
    jns.email_enabled,
    COALESCE(jns.email, lp.email) AS email,
    ARRAY_AGG(DISTINCT upt.push_token) FILTER (WHERE upt.push_token IS NOT NULL) AS push_tokens
  FROM job_notification_subscriptions jns
  LEFT JOIN user_push_tokens upt ON upt.user_id = jns.user_id
  LEFT JOIN library_people lp ON lp.user_id = jns.user_id AND lp.is_user = true
  WHERE jns.job_id = p_job_id
    AND jns.notified_at IS NULL
  GROUP BY jns.id, jns.user_id, jns.push_enabled, jns.email_enabled, jns.email, lp.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as sent
CREATE OR REPLACE FUNCTION mark_notifications_sent(p_subscription_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE job_notification_subscriptions
  SET notified_at = NOW()
  WHERE id = ANY(p_subscription_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE user_push_tokens IS 'Stores Expo/APNS/FCM push tokens for each user device';
COMMENT ON TABLE job_notification_subscriptions IS 'Tracks which users want notifications for which jobs';
