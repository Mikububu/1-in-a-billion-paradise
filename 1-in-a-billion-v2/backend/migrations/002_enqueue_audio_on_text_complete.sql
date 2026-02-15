-- Enqueue audio_generation tasks automatically when a text_generation task completes.
--
-- Motivation:
-- - Avoid storing huge text payloads in job_tasks.input
-- - Let RunPod workers process text in parallel, then immediately fan out audio tasks.
--
-- Requires: migrations/001_supabase_job_queue.sql

BEGIN;

CREATE OR REPLACE FUNCTION enqueue_audio_on_text_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_source_task_id TEXT;
  v_text_path TEXT;
  v_title TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Only react when status becomes complete for text_generation tasks
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF (NEW.task_type <> 'text_generation'::task_type) THEN
    RETURN NEW;
  END IF;

  IF (NEW.status <> 'complete'::task_status) THEN
    RETURN NEW;
  END IF;

  v_source_task_id := NEW.id::text;
  v_text_path := COALESCE(NEW.output->>'textArtifactPath', NULL);
  v_title := COALESCE(NEW.output->>'title', '');

  IF v_text_path IS NULL OR length(v_text_path) = 0 THEN
    -- If the worker didn't provide a text artifact path, we can't enqueue audio safely.
    RETURN NEW;
  END IF;

  -- Idempotency: do not enqueue twice
  SELECT EXISTS(
    SELECT 1
    FROM job_tasks
    WHERE job_id = NEW.job_id
      AND task_type = 'audio_generation'::task_type
      AND (input->>'sourceTaskId') = v_source_task_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

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
    NEW.job_id,
    'audio_generation'::task_type,
    'pending'::task_status,
    NEW.sequence + 1000,
    jsonb_build_object(
      'textArtifactPath', v_text_path,
      'title', v_title,
      'sourceTaskId', v_source_task_id,
      'docNum', COALESCE((NEW.output->>'docNum')::int, NULL)
    ),
    0,
    3,
    900
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enqueue_audio_on_text_complete ON job_tasks;

CREATE TRIGGER trg_enqueue_audio_on_text_complete
AFTER UPDATE OF status ON job_tasks
FOR EACH ROW
EXECUTE FUNCTION enqueue_audio_on_text_complete();

COMMIT;
