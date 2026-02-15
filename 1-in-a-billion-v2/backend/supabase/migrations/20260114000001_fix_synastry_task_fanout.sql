-- See: /migrations/022_fix_synastry_task_fanout.sql
-- This file is placed under supabase/migrations so `supabase db push` can apply it.
-- It fixes synastry to create 3 docs per system (person1, person2, overlay) and no verdict.

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

  IF NEW.type = 'nuclear_v2' THEN
    v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    v_doc_num := 1;

    FOREACH v_system IN ARRAY v_systems LOOP
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person1', 'system', v_system, 'title', v_system || ' - Person 1')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person2', 'system', v_system, 'title', v_system || ' - Person 2')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'overlay', 'system', v_system, 'title', v_system || ' - Overlay')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;

    INSERT INTO job_tasks (job_id, task_type, sequence, input)
    VALUES (
      NEW.id,
      'text_generation',
      v_sequence,
      jsonb_build_object('docNum', 16, 'docType', 'verdict', 'system', NULL, 'title', 'Final Verdict')
    );

  ELSIF NEW.type = 'extended' THEN
    v_systems := ARRAY(SELECT jsonb_array_elements_text(NEW.params->'systems'));
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
        jsonb_build_object('docNum', v_doc_num, 'docType', 'individual', 'system', v_system, 'title', v_system || ' Reading')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;

  ELSIF NEW.type = 'synastry' THEN
    v_systems := ARRAY(SELECT jsonb_array_elements_text(NEW.params->'systems'));
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
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person1', 'system', v_system, 'title', v_system || ' - Person 1')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person2', 'system', v_system, 'title', v_system || ' - Person 2')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'overlay', 'system', v_system, 'title', v_system || ' - Synastry')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;

  ELSIF NEW.type = 'nuclear' THEN
    v_systems := ARRAY(SELECT jsonb_array_elements_text(NEW.params->'systems'));
    IF v_systems IS NULL OR array_length(v_systems, 1) IS NULL THEN
      v_systems := ARRAY['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    END IF;

    v_doc_num := 1;
    FOREACH v_system IN ARRAY v_systems LOOP
      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person1', 'system', v_system, 'title', v_system || ' - Person 1')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'person2', 'system', v_system, 'title', v_system || ' - Person 2')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;

      INSERT INTO job_tasks (job_id, task_type, sequence, input)
      VALUES (
        NEW.id,
        'text_generation',
        v_sequence,
        jsonb_build_object('docNum', v_doc_num, 'docType', 'overlay', 'system', v_system, 'title', v_system || ' - Overlay')
      );
      v_sequence := v_sequence + 1;
      v_doc_num := v_doc_num + 1;
    END LOOP;
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

