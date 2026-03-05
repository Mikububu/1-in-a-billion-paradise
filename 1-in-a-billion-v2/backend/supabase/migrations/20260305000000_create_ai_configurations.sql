CREATE TABLE IF NOT EXISTS public.ai_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- RLS policies
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;

-- Only anon/authenticated users can SELECT (read-only for clients if needed, though mostly edge functions use this).
-- To be safe, let's just allow read access to everyone, but write access only to service role or admin.
CREATE POLICY "Allow public read access"
ON public.ai_configurations
FOR SELECT
TO public
USING (true);

-- Enable realtime
alter publication supabase_realtime add table public.ai_configurations;
