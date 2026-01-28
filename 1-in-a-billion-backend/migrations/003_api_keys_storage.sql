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

-- Insert Fly.io token
INSERT INTO api_keys (service, key_name, token, description) 
VALUES (
  'fly_io', 
  'Xmas', 
  'FlyV1 fm2_lJPECAAAAAAAEF9sxBC3r0n/U5NtaZ8wHuNjD1NowrVodHRwczovL2FwaS5mbHkuaW8vdjGWAJLOABVZNB8Lk7lodHRwczovL2FwaS5mbHkuaW8vYWFhL3YxxDzaTUIQogecmjkh6dQqdqedac+BKGAxVq+tQhkaD4e/QyQpbjh5Q5U7A2UOVIQQoq9Cl7nQtkwx/KdtA2nETtQMHO9TzTP37O9D0zWMCE6kS4zFbRypUH1NuoUlH9yrpQ8bqo7Fclz2KTXXXRzGpvwVAmJ+jDo6Jfjfwsj3u82/irXmdexPIMM8lbjxcA2SlAORgc4AvgfwHwWRgqdidWlsZGVyH6J3Zx8BxCBPEPdrq5kLb6EfaN9ShRj+mTwA+mDb5lx8SvHFMIi0FQ==',
  'Fly.io deploy token for 1-in-a-billion-backend'
) 
ON CONFLICT (service) DO UPDATE SET 
  token = EXCLUDED.token, 
  key_name = EXCLUDED.key_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Add other API keys
INSERT INTO api_keys (service, key_name, token, description) 
VALUES 
  ('deepseek', 'main', 'sk-a0730e467715414e967b8f24f657b82c', 'DeepSeek API for text generation'),
  ('claude', 'main', 'sk-ant-api03-sRsKvTaLZGj5PvyEa2Nmy2bfoerKPi3Wz9ExMLoNltj0k66EsiXoaKX9RI3Dn2dLd1-Ti7DS-7mXyd5PPb9w2vNEgAA', 'Claude API for overlay generation'),
  ('runpod', 'chatterbox', 'aaae1e11-e6e2-48c8-98fe-f6de7adbdf5e:cae859f950781e60d5c1fd86741b8c25', 'RunPod API for Chatterbox TTS'),
  ('runpod_endpoint', 'chatterbox', 'tyj2436ozcz419', 'RunPod endpoint ID for Chatterbox TTS')
ON CONFLICT (service) DO NOTHING;

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





