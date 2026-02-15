-- Create table for storing API keys and tokens
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL UNIQUE,
  key_name TEXT,
  token TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY: API keys should be added via Supabase Dashboard, NOT in migration files
-- The following are PLACEHOLDER examples only - never commit real keys!
-- 
-- To add keys, run this in Supabase Dashboard → SQL Editor:
--
-- INSERT INTO api_keys (service, key_name, token, description) 
-- VALUES 
--   ('fly_io', 'main', 'YOUR_FLY_TOKEN_HERE', 'Fly.io deploy token'),
--   ('deepseek', 'main', 'YOUR_DEEPSEEK_KEY_HERE', 'DeepSeek API for text generation'),
--   ('claude', 'main', 'YOUR_CLAUDE_KEY_HERE', 'Claude API for overlay generation'),
--   ('replicate', 'main', 'YOUR_REPLICATE_KEY_HERE', 'Replicate API for Chatterbox TTS'),
--   ('minimax', 'main', 'YOUR_MINIMAX_KEY_HERE', 'MiniMax API for song generation')
-- ON CONFLICT (service) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW();

-- Create function to get API key
CREATE OR REPLACE FUNCTION get_api_key(p_service TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT token FROM api_keys WHERE service = p_service LIMIT 1);
END;
$$;

-- Grant access
GRANT SELECT ON api_keys TO service_role;





