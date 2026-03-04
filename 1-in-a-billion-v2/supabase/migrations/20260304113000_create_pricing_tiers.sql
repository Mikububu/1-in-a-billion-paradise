-- Migration: Create pricing_tiers table

CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  provider TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  input_per_1m NUMERIC(10, 4) DEFAULT 0,
  output_per_1m NUMERIC(10, 4) DEFAULT 0,
  per_second NUMERIC(10, 6) DEFAULT 0,
  per_minute NUMERIC(10, 4) DEFAULT 0,
  per_item NUMERIC(10, 4) DEFAULT 0,
  tts_per_10k_chars NUMERIC(10, 4) DEFAULT 0,
  model_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins) can read/write pricing_tiers
CREATE POLICY "Admins can select pricing_tiers" ON public.pricing_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update pricing_tiers" ON public.pricing_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert initial values based on current hardcoded prices
INSERT INTO public.pricing_tiers (provider, name, input_per_1m, output_per_1m, per_second, per_minute, per_item, tts_per_10k_chars, model_name)
VALUES
  ('deepseek', 'DeepSeek', 0.14, 0.28, 0, 0, 0, 0, 'deepseek-chat'),
  ('claude', 'Claude Sonnet 4', 3.00, 15.00, 0, 0, 0, 0, 'claude-sonnet-4-20250514'),
  ('openai', 'OpenAI GPT-4o', 2.50, 10.00, 0, 0, 0, 0, 'gpt-4o'),
  ('replicate', 'Replicate API', 0, 0, 0.00039, 0.0234, 0, 0, null),
  ('minimax', 'MiniMax', 0, 0, 0, 0, 0.05, 0.035, null),
  ('google_ai_studio', 'Google AI Studio', 0, 0, 0, 0, 0.05, 0, 'gemini-3-pro-image-preview'),
  ('google_tts', 'Google TTS', 0, 0, 0, 0, 0, 0.16, 'chirp-3-hd')
ON CONFLICT (provider) DO NOTHING;
