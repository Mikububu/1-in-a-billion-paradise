-- ═══════════════════════════════════════════════════════════════════════════
-- ONE-TIME FIX: Backfill tasks for stuck bundle_verdict job
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The job 13da815d-e43f-4b40-b1ea-a22da6d48402 was inserted BEFORE
-- the trigger had a bundle_verdict branch, so it has 0 tasks.
-- This creates the 16 tasks manually.
--
-- Run this AFTER 032_add_bundle_verdict_task_fanout.sql
-- Then either delete the stuck job and re-trigger from the app,
-- or use this script to backfill tasks directly.
--
-- OPTION A: Delete the stuck job and re-trigger from the app (cleanest)
--   DELETE FROM jobs WHERE id = '13da815d-e43f-4b40-b1ea-a22da6d48402';
--   Then trigger a new reading from the app — the updated trigger will create tasks.
--
-- OPTION B: Backfill tasks for the existing job (below)
--   This inserts 16 tasks matching what the trigger would have created.

DO $$
DECLARE
  v_job_id UUID := '13da815d-e43f-4b40-b1ea-a22da6d48402';
  v_systems TEXT[] := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
  v_system TEXT;
  v_doc_num INTEGER := 1;
  v_sequence INTEGER := 0;
  v_task_count INTEGER;
BEGIN
  -- Safety check: only run if the job has 0 tasks
  SELECT COUNT(*) INTO v_task_count FROM job_tasks WHERE job_id = v_job_id;
  IF v_task_count > 0 THEN
    RAISE NOTICE 'Job % already has % tasks — skipping backfill', v_job_id, v_task_count;
    RETURN;
  END IF;

  -- Also verify the job actually exists and is bundle_verdict
  PERFORM 1 FROM jobs WHERE id = v_job_id AND type = 'bundle_verdict';
  IF NOT FOUND THEN
    RAISE NOTICE 'Job % not found or not bundle_verdict — skipping', v_job_id;
    RETURN;
  END IF;

  FOREACH v_system IN ARRAY v_systems LOOP
    -- Person 1
    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      v_job_id, 'text_generation', v_sequence,
      jsonb_build_object('docNum', v_doc_num, 'docType', 'person1', 'system', v_system, 'title', v_system || ' - Person 1')
    );
    v_sequence := v_sequence + 1;
    v_doc_num := v_doc_num + 1;

    -- Person 2
    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      v_job_id, 'text_generation', v_sequence,
      jsonb_build_object('docNum', v_doc_num, 'docType', 'person2', 'system', v_system, 'title', v_system || ' - Person 2')
    );
    v_sequence := v_sequence + 1;
    v_doc_num := v_doc_num + 1;

    -- Overlay
    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      v_job_id, 'text_generation', v_sequence,
      jsonb_build_object('docNum', v_doc_num, 'docType', 'overlay', 'system', v_system, 'title', v_system || ' - Overlay')
    );
    v_sequence := v_sequence + 1;
    v_doc_num := v_doc_num + 1;
  END LOOP;

  -- Final verdict (doc 16)
  INSERT INTO job_tasks (job_id, task_type, sequence, input)
  VALUES (
    v_job_id, 'text_generation', v_sequence,
    jsonb_build_object('docNum', 16, 'docType', 'verdict', 'system', NULL, 'title', 'Final Verdict')
  );

  RAISE NOTICE 'Created 16 tasks for stuck bundle_verdict job %', v_job_id;
END $$;
