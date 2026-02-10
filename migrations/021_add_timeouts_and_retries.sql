-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 021: ADD TIMEOUTS AND RETRIES
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- ADDS:
-- 1. Auto-fail jobs stuck in 'queued' for > 30 minutes
-- 2. Auto-fail tasks stuck in 'pending' or 'processing' for > heartbeat_timeout
-- 3. Auto-retry failed audio tasks up to max_attempts
-- 4. Health check monitoring
-- 
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION 1: Auto-fail stuck queued jobs
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_stuck_queued_jobs()
RETURNS void AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Fail jobs stuck in 'queued' for more than 30 minutes
  UPDATE jobs
  SET 
    status = 'failed',
    error_message = 'Job stuck in queue for > 30 minutes. Orchestrator may not be running.',
    updated_at = NOW()
  WHERE status = 'queued'
    AND created_at < NOW() - INTERVAL '30 minutes'
  RETURNING id INTO v_updated_count;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE 'Cleaned up % stuck queued jobs', v_updated_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION 2: Auto-fail stuck processing tasks
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_stuck_processing_tasks()
RETURNS void AS $$
DECLARE
  v_task RECORD;
  v_timeout_seconds INTEGER;
  v_updated_count INTEGER := 0;
BEGIN
  -- Find tasks stuck in 'processing' or 'pending' beyond their heartbeat timeout
  FOR v_task IN
    SELECT 
      id,
      task_type,
      status,
      heartbeat_timeout_seconds,
      updated_at,
      EXTRACT(EPOCH FROM (NOW() - updated_at))::INTEGER AS age_seconds
    FROM job_tasks
    WHERE status IN ('processing', 'pending')
      AND heartbeat_timeout_seconds IS NOT NULL
      AND updated_at < NOW() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL
  LOOP
    -- Mark task as failed
    UPDATE job_tasks
    SET 
      status = 'failed',
      error_message = format(
        'Task timeout: stuck in %s for %s seconds (timeout: %s seconds). Worker may have crashed.',
        v_task.status,
        v_task.age_seconds,
        v_task.heartbeat_timeout_seconds
      ),
      updated_at = NOW()
    WHERE id = v_task.id;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE 'Cleaned up % stuck processing tasks', v_updated_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION 3: Auto-retry failed tasks
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION retry_failed_tasks()
RETURNS void AS $$
DECLARE
  v_task RECORD;
  v_retried_count INTEGER := 0;
BEGIN
  -- Find failed tasks that still have retry attempts left
  FOR v_task IN
    SELECT id, task_type, attempts, max_attempts, error_message
    FROM job_tasks
    WHERE status = 'failed'
      AND attempts < max_attempts
      AND updated_at < NOW() - INTERVAL '2 minutes'  -- Wait 2 min before retry
  LOOP
    -- Reset task to pending for retry
    UPDATE job_tasks
    SET 
      status = 'pending',
      attempts = attempts + 1,
      error_message = NULL,
      updated_at = NOW()
    WHERE id = v_task.id;
    
    v_retried_count := v_retried_count + 1;
    
    RAISE NOTICE 'Retrying task % (attempt %/%): %', 
      v_task.id, 
      v_task.attempts + 1, 
      v_task.max_attempts,
      v_task.task_type;
  END LOOP;
  
  IF v_retried_count > 0 THEN
    RAISE NOTICE 'Retried % failed tasks', v_retried_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION 4: Combined health check
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION run_job_health_check()
RETURNS void AS $$
BEGIN
  PERFORM cleanup_stuck_queued_jobs();
  PERFORM cleanup_stuck_processing_tasks();
  PERFORM retry_failed_tasks();
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ───────────────────────────────────────────────────────────────────────────

ALTER FUNCTION cleanup_stuck_queued_jobs() SET search_path = public;
ALTER FUNCTION cleanup_stuck_processing_tasks() SET search_path = public;
ALTER FUNCTION retry_failed_tasks() SET search_path = public;
ALTER FUNCTION run_job_health_check() SET search_path = public;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- USAGE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Manual execution:
--   SELECT run_job_health_check();
-- 
-- Add to cron (if using pg_cron extension):
--   SELECT cron.schedule('job-health-check', '*/5 * * * *', 'SELECT run_job_health_check()');
-- 
-- Or call from backend every 5 minutes:
--   setInterval(async () => {
--     await supabase.rpc('run_job_health_check');
--   }, 5 * 60 * 1000);
-- 
-- ═══════════════════════════════════════════════════════════════════════════
