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

-- Insert or update MiniMax API key
INSERT INTO api_keys (service, key_name, token, description) 
VALUES (
  'minimax', 
  'main', 
  'sk-api-xWT7nhj_tK-5XckrK03LCM_CSAlQuzODSgicp0RvVuZc6rtNpjAaT3FhEHvgHg2kDTEJ1c-XLSZO86DWa6bUtvo-IKqIuXDG_dzYLuarZhlm5yo9M7cS7P0',
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

