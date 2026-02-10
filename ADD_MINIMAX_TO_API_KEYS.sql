-- Add MiniMax API key to api_keys table
-- Run this in Supabase Dashboard → SQL Editor

-- Check if api_keys table exists first, if not create it:
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL UNIQUE,
  key_name TEXT,
  token TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY: Never commit real API keys! Add via Supabase Dashboard.
-- Insert or update MiniMax API key
INSERT INTO api_keys (service, key_name, token, description) 
VALUES (
  'minimax', 
  'main', 
  'YOUR_MINIMAX_API_KEY_HERE',  -- Get from MiniMax dashboard
  'MiniMax API key for music/song generation'
) 
ON CONFLICT (service) DO UPDATE SET 
  token = EXCLUDED.token, 
  key_name = EXCLUDED.key_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify
SELECT service, key_name, description, created_at 
FROM api_keys 
WHERE service = 'minimax';

