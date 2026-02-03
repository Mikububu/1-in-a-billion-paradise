-- Add MiniMax API key to Supabase api_keys table
-- Run this in Supabase Dashboard → SQL Editor

-- First, ensure the api_keys table exists (if not, run migration 003 first)
-- Then insert or update the MiniMax key:

-- SECURITY: Never commit real API keys! Add via Supabase Dashboard.
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

-- Verify the key was added:
SELECT service, key_name, description, created_at 
FROM api_keys 
WHERE service = 'minimax';

