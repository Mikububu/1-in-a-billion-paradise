-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add output_language for multilingual support
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE: Prepare infrastructure for multilingual reading generation
-- 
-- ARCHITECTURE:
-- - output_language: The language readings are generated in
-- - Defaults to 'en' (English)
-- - Future: 'es' (Spanish), 'zh' (Chinese)
-- 
-- STRATEGY (to be decided later):
-- - Option A: LLM generates directly in target language
-- - Option B: Generate English → translate with Hunyuan-MT
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add output_language to jobs table
-- This tracks what language the reading was generated in
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'en';

-- Add output_language to library_people table
-- This stores the user's preferred reading language
ALTER TABLE library_people 
  ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'en';

-- Create index for language-based queries
CREATE INDEX IF NOT EXISTS idx_jobs_output_language ON jobs(output_language);
CREATE INDEX IF NOT EXISTS idx_library_people_output_language ON library_people(output_language);

-- Add comment for documentation
COMMENT ON COLUMN jobs.output_language IS 'Language code for generated reading content (en, es, zh)';
COMMENT ON COLUMN library_people.output_language IS 'Preferred language for reading generation (en, es, zh)';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' AND column_name = 'output_language';
-- 
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'library_people' AND column_name = 'output_language';
