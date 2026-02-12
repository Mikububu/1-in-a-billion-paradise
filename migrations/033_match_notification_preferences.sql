-- Match notification preferences (consent + first-match delivery tracking)
-- Purpose:
-- 1) Record explicit user consent for match alerts
-- 2) Store channel preferences (single product toggle mapped to email + push)
-- 3) Track first-match notification delivery so it is sent once

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_match_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  match_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_asked_at TIMESTAMPTZ,
  consent_source TEXT,
  first_match_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_notification_enabled
  ON public.user_match_notification_preferences (match_alerts_enabled);

ALTER TABLE public.user_match_notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_match_notification_preferences'
      AND policyname = 'Users can view own match notification preferences'
  ) THEN
    CREATE POLICY "Users can view own match notification preferences"
      ON public.user_match_notification_preferences
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_match_notification_preferences'
      AND policyname = 'Users can insert own match notification preferences'
  ) THEN
    CREATE POLICY "Users can insert own match notification preferences"
      ON public.user_match_notification_preferences
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_match_notification_preferences'
      AND policyname = 'Users can update own match notification preferences'
  ) THEN
    CREATE POLICY "Users can update own match notification preferences"
      ON public.user_match_notification_preferences
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_match_notification_preferences'
      AND policyname = 'Service role full access match notification preferences'
  ) THEN
    CREATE POLICY "Service role full access match notification preferences"
      ON public.user_match_notification_preferences
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON public.user_match_notification_preferences TO authenticated;
GRANT ALL ON public.user_match_notification_preferences TO service_role;

COMMENT ON TABLE public.user_match_notification_preferences IS
'Per-user consent and delivery state for match alerts (email/push + first-match sent marker).';

COMMIT;
