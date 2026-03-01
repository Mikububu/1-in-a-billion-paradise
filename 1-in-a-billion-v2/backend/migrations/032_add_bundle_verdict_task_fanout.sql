-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 032: ADD BUNDLE_VERDICT TASK FAN-OUT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problem: bundle_verdict jobs were inserted but auto_create_job_tasks()
-- had no branch for this type, so 0 job_tasks rows were created and
-- the worker had nothing to claim. Jobs sat at 0% forever.
--
-- Fix: Add a bundle_verdict branch that creates the same 16-task structure
-- as nuclear_v2: 5 systems × 3 docs (person1, person2, overlay) + 1 verdict.
-- Uses params->'systems' array (like extended/synastry) with a fallback to
-- all 5 systems if not provided.
--
BEGIN;

CREATE OR REPLACE FUNCTION auto_create_job_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_systems TEXT[];
  v_system TEXT;
  v_doc_num INTEGER;
  v_sequence INTEGER := 0;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- ═════════════════════════════════════════════════════════════════════════
  -- NUCLEAR_V2: 16 documents (5 systems × 3 docs each + 1 verdict)
  -- ═════════════════════════════════════════════════════════════════════════
  IF NEW.type = 'nuclear_v2' THEN
    v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    v_doc_num := 1;

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
  -- BUNDLE_VERDICT: "Complete Reading" — same as nuclear_v2 structure
  -- Uses params->'systems' from the client, defaults to all 5 if missing.
  -- 5 systems × 3 docs (person1, person2, overlay) + 1 verdict = 16 tasks
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'bundle_verdict' THEN
    -- Read systems from params; fall back to all 5
    BEGIN
      v_systems := ARRAY(
        SELECT jsonb_array_elements_text(NEW.params->'systems')
      );
    EXCEPTION WHEN OTHERS THEN
      v_systems := NULL;
    END;

    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    END IF;

    v_doc_num := 1;

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

    -- Final verdict (last doc)
    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      NEW.id,
      'text_generation',
      v_sequence,
      jsonb_build_object(
        'docNum', v_doc_num,
        'docType', 'verdict',
        'system', NULL,
        'title', 'Final Verdict'
      )
    );

    RAISE NOTICE 'Created % text_generation tasks for bundle_verdict job %',
      (array_length(v_systems, 1) * 3) + 1, NEW.id;

  -- ═════════════════════════════════════════════════════════════════════════
  -- EXTENDED: Variable number of tasks based on params.systems
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'extended' THEN
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );

    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western'];
    END IF;

    v_doc_num := 1;

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
  -- SYNASTRY: Single-system overlay purchase (3 docs per system)
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'synastry' THEN
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );

    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western'];
    END IF;

    v_doc_num := 1;

    -- For each system: Person 1, Person 2, Overlay (NO verdict)
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
          'title', v_system || ' - Synastry'
        )
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;

    RAISE NOTICE 'Created % text_generation tasks for synastry job %', (array_length(v_systems, 1) * 3), NEW.id;

  -- ═════════════════════════════════════════════════════════════════════════
  -- NUCLEAR (legacy)
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'nuclear' THEN
    v_systems := ARRAY(
      SELECT jsonb_array_elements_text(NEW.params->'systems')
    );

    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    END IF;

    v_doc_num := 1;

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

    RAISE NOTICE 'Created % text_generation tasks for nuclear job %', (array_length(v_systems, 1) * 3), NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_job_tasks ON jobs;
CREATE TRIGGER trg_auto_create_job_tasks
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION auto_create_job_tasks();

COMMIT;
