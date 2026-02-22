-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 015: FIX AUDIO TASK TIMEOUT
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PROBLEM: Audio tasks can take up to 60 minutes (RunPod cold start + 
-- 16 chapters with polling), but heartbeat_timeout_seconds was only 900 (15 min).
-- This causes watchdog to reclaim tasks mid-processing, creating infinite loops.
--
-- FIX: Increase audio task timeout to 3600 seconds (60 minutes)
-- Also increase song task timeout for safety (MiniMax API can be slow)
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Update existing audio tasks to have 60 minute timeout
UPDATE job_tasks 
SET heartbeat_timeout_seconds = 3600 
WHERE task_type = 'audio_generation'
  AND heartbeat_timeout_seconds < 3600;

-- Update existing song tasks to have 60 minute timeout  
UPDATE job_tasks 
SET heartbeat_timeout_seconds = 3600 
WHERE task_type = 'song_generation'
  AND heartbeat_timeout_seconds < 3600;

-- Update the trigger that creates post-text tasks to use correct timeouts
CREATE OR REPLACE FUNCTION enqueue_all_post_text_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_text_tasks_complete INTEGER;
  v_text_tasks_total INTEGER;
  v_pdf_already_enqueued INTEGER;
  v_audio_already_enqueued INTEGER;
  v_song_already_enqueued INTEGER;
  v_text_task RECORD;
  v_pdf_count INTEGER := 0;
  v_audio_count INTEGER := 0;
  v_song_count INTEGER := 0;
BEGIN
  -- Only react when a text task completes
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.task_type <> 'text_generation' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'complete' THEN
    RETURN NEW;
  END IF;

  v_job_id := NEW.job_id;

  -- Count text tasks: complete vs total
  SELECT 
    COUNT(*) FILTER (WHERE status = 'complete') AS complete,
    COUNT(*) AS total
  INTO v_text_tasks_complete, v_text_tasks_total
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'text_generation';

  -- Only proceed if ALL text tasks are complete
  IF v_text_tasks_complete < v_text_tasks_total THEN
    RETURN NEW;
  END IF;

  RAISE NOTICE 'All text tasks complete for job %. Enqueueing PDF, Audio, and Song tasks...', v_job_id;

  -- Check what's already enqueued (idempotency)
  SELECT 
    COUNT(*) FILTER (WHERE task_type = 'pdf_generation'),
    COUNT(*) FILTER (WHERE task_type = 'audio_generation'),
    COUNT(*) FILTER (WHERE task_type = 'song_generation')
  INTO v_pdf_already_enqueued, v_audio_already_enqueued, v_song_already_enqueued
  FROM job_tasks
  WHERE job_id = v_job_id;

  -- Enqueue PDF, Audio, and Song tasks for each completed text task
  FOR v_text_task IN
    SELECT id, sequence, output, input
    FROM job_tasks
    WHERE job_id = v_job_id
      AND task_type = 'text_generation'
      AND status = 'complete'
    ORDER BY sequence
  LOOP
    -- 1. PDF GENERATION (if not already enqueued)
    IF v_pdf_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id,
        task_type,
        status,
        sequence,
        input,
        attempts,
        max_attempts,
        heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'pdf_generation',
        'pending',
        v_text_task.sequence + 100,  -- PDFs: sequence 100-115
        jsonb_build_object(
          'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
          'title', COALESCE(v_text_task.output->>'title', ''),
          'sourceTaskId', v_text_task.id::text,
          'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL),
          'docType', COALESCE(v_text_task.output->>'docType', NULL),
          'system', COALESCE(v_text_task.output->>'system', NULL)
        ),
        0,
        3,
        600  -- 10 minutes timeout for PDF (CPU-bound, fast)
      );
      v_pdf_count := v_pdf_count + 1;
    END IF;

    -- 2. AUDIO GENERATION (if not already enqueued)
    -- *** FIXED: 60 minute timeout (was 15 min) ***
    IF v_audio_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id,
        task_type,
        status,
        sequence,
        input,
        attempts,
        max_attempts,
        heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'audio_generation',
        'pending',
        v_text_task.sequence + 200,  -- Audio: sequence 200-215
        jsonb_build_object(
          'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
          'title', COALESCE(v_text_task.output->>'title', ''),
          'sourceTaskId', v_text_task.id::text,
          'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL)
        ),
        0,
        3,
        3600  -- *** 60 minutes timeout (RunPod cold start + chunked TTS) ***
      );
      v_audio_count := v_audio_count + 1;
    END IF;

    -- 3. SONG GENERATION (if not already enqueued)
    -- *** FIXED: 60 minute timeout ***
    IF v_song_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id,
        task_type,
        status,
        sequence,
        input,
        attempts,
        max_attempts,
        heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'song_generation',
        'pending',
        v_text_task.sequence + 300,  -- Songs: sequence 300-315
        jsonb_build_object(
          'docNum', COALESCE((v_text_task.input->>'docNum')::int, NULL),
          'docType', COALESCE(v_text_task.input->>'docType', NULL),
          'system', COALESCE(v_text_task.input->>'system', NULL),
          'sourceTaskId', v_text_task.id::text,
          'personName', COALESCE(v_text_task.input->>'personName', 'User')
        ),
        0,
        3,
        3600  -- *** 60 minutes timeout (MiniMax API can be slow) ***
      );
      v_song_count := v_song_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Enqueued for job %: PDF=%, AUDIO=%, SONG=%', 
    v_job_id, v_pdf_count, v_audio_count, v_song_count;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
ALTER FUNCTION enqueue_all_post_text_tasks() SET search_path = public;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Check audio task timeouts:
-- SELECT task_type, heartbeat_timeout_seconds, COUNT(*) 
-- FROM job_tasks 
-- GROUP BY task_type, heartbeat_timeout_seconds 
-- ORDER BY task_type;
--
-- Expected: audio_generation and song_generation should show 3600
-- 
-- ═══════════════════════════════════════════════════════════════════════════
