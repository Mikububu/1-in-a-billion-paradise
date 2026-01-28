-- Fix audio task timeout: 3600 (1 hour) → 900 (15 minutes)
-- Run in Supabase SQL Editor

-- 1. Fix existing tasks
UPDATE job_tasks 
SET heartbeat_timeout_seconds = 900
WHERE task_type = 'audio_generation' 
  AND heartbeat_timeout_seconds = 3600;

-- 2. Fix the trigger function (one line change: 3600 → 900)
-- Find and replace "3600" with "900" in the audio_generation INSERT
-- Or run this to see current function:
-- SELECT pg_get_functiondef('enqueue_all_post_text_tasks'::regproc);
