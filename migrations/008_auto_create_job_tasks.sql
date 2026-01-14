-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-CREATE JOB TASKS ON JOB INSERT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This migration adds a trigger that automatically creates job_tasks when a
-- job is inserted, based on the job type.
--
-- Task fan-out logic:
-- - nuclear_v2: Creates 16 tasks (15 text + 1 verdict)
-- - extended: Creates tasks based on params.systems array
-- - synastry: Creates synastry calculation tasks
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION: Auto-create tasks based on job type
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_create_job_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_systems TEXT[];
  v_system TEXT;
  v_doc_num INTEGER;
  v_sequence INTEGER := 0;
BEGIN
  -- Only create tasks if job is newly inserted
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- ═════════════════════════════════════════════════════════════════════════
  -- NUCLEAR_V2: 16 documents (5 systems × 3 docs each + 1 verdict)
  -- ═════════════════════════════════════════════════════════════════════════
  IF NEW.type = 'nuclear_v2' THEN
    -- Systems: western, vedic, human_design, gene_keys, kabbalah
    v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    
    v_doc_num := 1;
    
    -- For each system: Person 1, Person 2, Overlay
    FOREACH v_system IN ARRAY v_systems LOOP
      -- Person 1 reading
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'person1',
          'system', v_system,
          'title', v_system || ' - Person 1'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
      
      -- Person 2 reading
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'person2',
          'system', v_system,
          'title', v_system || ' - Person 2'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
      
      -- Overlay reading
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'overlay',
          'system', v_system,
          'title', v_system || ' - Overlay'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;
    
    -- Final verdict (doc 16)
    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      NEW.id,
      'text_generation',
      v_sequence,
      jsonb_build_object(
        'docNum', 16,
        'docType', 'verdict',
        'system', NULL,
        'title', 'Final Verdict'
      )
    );
    
    RAISE NOTICE 'Created 16 text_generation tasks for nuclear_v2 job %', NEW.id;
  
  -- ═════════════════════════════════════════════════════════════════════════
  -- EXTENDED: Variable number of tasks based on params.systems
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'extended' THEN
    -- Extract systems from params
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );
    
    -- If no systems specified, default to western
    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western'];
    END IF;
    
    v_doc_num := 1;
    
    -- Create one text task per system
    FOREACH v_system IN ARRAY v_systems LOOP
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'individual',
          'system', v_system,
          'title', v_system || ' Reading'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % text_generation tasks for extended job %', array_length(v_systems, 1), NEW.id;
  
  -- ═════════════════════════════════════════════════════════════════════════
  -- SYNASTRY: Relationship compatibility analysis
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'synastry' THEN
    -- Extract systems from params
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );
    
    -- If no systems specified, default to western
    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western'];
    END IF;
    
    v_doc_num := 1;
    
    -- Create synastry overlay task for each system
    FOREACH v_system IN ARRAY v_systems LOOP
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'overlay',
          'system', v_system,
          'title', v_system || ' Synastry'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % text_generation tasks for synastry job %', array_length(v_systems, 1), NEW.id;
  
  -- ═════════════════════════════════════════════════════════════════════════
  -- NUCLEAR (legacy): Similar to nuclear_v2 but older format
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'nuclear' THEN
    -- Extract systems from params
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );
    
    -- If no systems specified, use default 5 systems
    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    END IF;
    
    v_doc_num := 1;
    
    -- Create tasks for each system (person1, person2, overlay)
    FOREACH v_system IN ARRAY v_systems LOOP
      -- Person 1
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'person1',
          'system', v_system,
          'title', v_system || ' - Person 1'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
      
      -- Person 2
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'person2',
          'system', v_system,
          'title', v_system || ' - Person 2'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
      
      -- Overlay
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object(
          'docNum', v_doc_num,
          'docType', 'overlay',
          'system', v_system,
          'title', v_system || ' - Overlay'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % text_generation tasks for nuclear job %', array_length(v_systems, 1) * 3, NEW.id;
  
  ELSE
    RAISE WARNING 'Unknown job type: %. No tasks created.', NEW.type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGER: Auto-create tasks on job insert
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_auto_create_job_tasks ON jobs;

CREATE TRIGGER trg_auto_create_job_tasks
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_job_tasks();

-- ───────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ───────────────────────────────────────────────────────────────────────────

-- Function is called by trigger, so it needs to be executable by the trigger owner
ALTER FUNCTION auto_create_job_tasks() SET search_path = public;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Test the trigger:
-- INSERT INTO jobs (user_id, type, params)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   'nuclear_v2',
--   '{"person1": {}, "person2": {}}'::jsonb
-- )
-- RETURNING id;

-- Check tasks were created:
-- SELECT id, task_type, sequence, input->>'docNum' as doc_num, input->>'system' as system
-- FROM job_tasks
-- WHERE job_id = '<job_id>'
-- ORDER BY sequence;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
