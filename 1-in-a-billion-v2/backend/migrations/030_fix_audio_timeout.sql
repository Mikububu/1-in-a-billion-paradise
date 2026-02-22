-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 030: Fix audio task heartbeat timeout (1 hour → 15 minutes)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: Audio tasks have heartbeat_timeout_seconds = 3600 (1 hour), meaning
--          if a worker crashes, tasks won't be reclaimed for a full hour.
--          This causes stuck jobs that appear frozen to users.
--
-- ROOT CAUSE: Migration 018 explicitly set 3600 for audio tasks while PDF/song
--             tasks correctly use 600.
--
-- FIX: Change audio timeout to 900 (15 minutes) - long enough for normal
--      processing but short enough for quick recovery from crashes.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Update the trigger function to use 900 instead of 3600 for audio
CREATE OR REPLACE FUNCTION enqueue_all_post_text_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_text_tasks_complete INTEGER;
  v_text_tasks_total INTEGER;
  v_job_params JSONB;
  v_voice_id TEXT;
  v_audio_url TEXT;
  v_text_task RECORD;
  v_pdf_already_enqueued INTEGER;
  v_audio_already_enqueued INTEGER;
  v_song_already_enqueued INTEGER;
  v_pdf_count INTEGER := 0;
  v_audio_count INTEGER := 0;
  v_song_count INTEGER := 0;
BEGIN
  -- Only proceed on text_generation task completion
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;
  
  IF (OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;
  
  IF (NEW.task_type <> 'text_generation') THEN
    RETURN NEW;
  END IF;
  
  IF (NEW.status <> 'complete'::task_status) THEN
    RETURN NEW;
  END IF;
  
  v_job_id := NEW.job_id;
  
  -- Get job params for voice selection
  SELECT params INTO v_job_params FROM jobs WHERE id = v_job_id;
  v_voice_id := COALESCE(v_job_params->>'voiceId', 'david');
  v_audio_url := COALESCE(
    v_job_params->>'audioUrl',
    'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/' || v_voice_id || '.wav'
  );
  
  -- Count text task completion
  SELECT 
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*)
  INTO v_text_tasks_complete, v_text_tasks_total
  FROM job_tasks
  WHERE job_id = v_job_id AND task_type = 'text_generation';
  
  -- Only proceed when ALL text tasks are complete
  IF v_text_tasks_complete < v_text_tasks_total THEN
    RETURN NEW;
  END IF;
  
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
    -- PDF task (sequence 100-115)
    IF v_pdf_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id, task_type, status, sequence, input, attempts, max_attempts, heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'pdf_generation',
        'pending',
        v_text_task.sequence + 100,
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
        600  -- 10 minutes
      );
      v_pdf_count := v_pdf_count + 1;
    END IF;
    
    -- Audio task (sequence 200-215)
    -- FIX: Changed from 3600 (1 hour) to 900 (15 minutes) for faster crash recovery
    IF v_audio_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id, task_type, status, sequence, input, attempts, max_attempts, heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'audio_generation',
        'pending',
        v_text_task.sequence + 200,
        jsonb_build_object(
          'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
          'title', COALESCE(v_text_task.output->>'title', ''),
          'sourceTaskId', v_text_task.id::text,
          'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL),
          'docType', COALESCE(v_text_task.output->>'docType', NULL),
          'system', COALESCE(v_text_task.output->>'system', NULL),
          'voiceId', v_voice_id,
          'audioUrl', v_audio_url
        ),
        0,
        3,
        900  -- 15 minutes (was 3600 = 1 hour, way too long for crash recovery)
      );
      v_audio_count := v_audio_count + 1;
    END IF;
    
    -- Song task (sequence 300-315)
    IF v_song_already_enqueued = 0 THEN
      INSERT INTO job_tasks (
        job_id, task_type, status, sequence, input, attempts, max_attempts, heartbeat_timeout_seconds
      ) VALUES (
        v_job_id,
        'song_generation',
        'pending',
        v_text_task.sequence + 300,
        jsonb_build_object(
          'sourceTaskId', v_text_task.id::text,
          'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL),
          'docType', COALESCE(v_text_task.output->>'docType', NULL),
          'system', COALESCE(v_text_task.output->>'system', NULL),
          'personName', 'User'
        ),
        0,
        3,
        600  -- 10 minutes
      );
      v_song_count := v_song_count + 1;
    END IF;
  END LOOP;
  
  IF v_pdf_count > 0 OR v_audio_count > 0 OR v_song_count > 0 THEN
    RAISE NOTICE 'Enqueued % PDF, % Audio, % Song tasks for job %', v_pdf_count, v_audio_count, v_song_count, v_job_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update any existing audio tasks that are stuck with the old 3600 timeout
-- This fixes tasks created before this migration
UPDATE job_tasks 
SET heartbeat_timeout_seconds = 900
WHERE task_type = 'audio_generation' 
  AND heartbeat_timeout_seconds = 3600;

COMMIT;
