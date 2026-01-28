-- Add MiniMax API key to Supabase api_keys table
-- Run this in Supabase Dashboard → SQL Editor

-- First, ensure the api_keys table exists (if not, run migration 003 first)
-- Then insert or update the MiniMax key:

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

-- Verify the key was added:
SELECT service, key_name, description, created_at 
FROM api_keys 
WHERE service = 'minimax';

