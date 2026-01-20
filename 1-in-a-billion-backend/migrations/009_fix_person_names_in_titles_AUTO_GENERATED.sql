/**
 * AUTO-GENERATED DATABASE MIGRATION
 * 
 * This migration is generated from src/config/systemConfig.ts
 * to ensure database and application code always stay in sync.
 * 
 * To regenerate: npm run generate-migration-009
 */

-- Drop existing trigger
DROP TRIGGER IF EXISTS auto_create_job_tasks_trigger ON jobs;
DROP FUNCTION IF EXISTS auto_create_job_tasks();

-- Recreate trigger with actual person names and correct system display names
CREATE OR REPLACE FUNCTION auto_create_job_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_system TEXT;
  v_person1_name TEXT;
  v_person2_name TEXT;
  v_display_name TEXT;
  doc_num INT;
BEGIN
  -- Extract system from params
  v_system := COALESCE(NEW.params->>'system', 'western');
  
  -- Extract person names from params (REAL NAMES, not "Person 1"/"Person 2")
  v_person1_name := COALESCE(NEW.params->'person1'->>'name', 'Person 1');
  v_person2_name := COALESCE(NEW.params->'person2'->>'name', 'Person 2');
  
  -- Map system slug to display name (GENERATED FROM systemConfig.ts)
  v_display_name := CASE
    WHEN v_system = 'vedic' THEN 'Vedic Astrology (Jyotish)'
    WHEN v_system = 'western' THEN 'Western Astrology'
    WHEN v_system = 'kabbalah' THEN 'Kabbalah'
    WHEN v_system = 'numerology' THEN 'Numerology'
    WHEN v_system = 'i_ching' THEN 'I Ching'
    ELSE v_system
  END;

  -- Job type: extended (1 doc)
  IF NEW.type = 'extended' THEN
    INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
    VALUES (
      NEW.id,
      1,
      'text_generation',
      jsonb_build_object(
        'docNum', 1,
        'docType', 'individual',
        'system', v_system,
        'title', v_display_name || ' - ' || v_person1_name
      ),
      'pending'
    );
    RETURN NEW;
  END IF;

  -- Job type: synastry (3 docs per system: person1, person2, overlay)
  IF NEW.type = 'synastry' THEN
    doc_num := 0;

    -- Person 1 reading
    doc_num := doc_num + 1;
    INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
    VALUES (
      NEW.id,
      doc_num,
      'text_generation',
      jsonb_build_object(
        'docNum', doc_num,
        'docType', 'person1',
        'system', v_system,
        'title', v_display_name || ' - ' || v_person1_name
      ),
      'pending'
    );

    -- Person 2 reading
    doc_num := doc_num + 1;
    INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
    VALUES (
      NEW.id,
      doc_num,
      'text_generation',
      jsonb_build_object(
        'docNum', doc_num,
        'docType', 'person2',
        'system', v_system,
        'title', v_display_name || ' - ' || v_person2_name
      ),
      'pending'
    );

    -- Overlay reading
    doc_num := doc_num + 1;
    INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
    VALUES (
      NEW.id,
      doc_num,
      'text_generation',
      jsonb_build_object(
        'docNum', doc_num,
        'docType', 'overlay',
        'system', v_system,
        'title', v_display_name || ' - ' || v_person1_name || ' & ' || v_person2_name
      ),
      'pending'
    );

    RETURN NEW;
  END IF;

  -- Job type: nuclear_v2 (16 docs: 5 systems × 3 docs + 1 verdict)
  IF NEW.type = 'nuclear_v2' THEN
    doc_num := 0;

    -- For each system: person1, person2, overlay
    FOR v_system IN SELECT unnest(ARRAY['vedic', 'western', 'kabbalah', 'numerology', 'i_ching']) LOOP
      v_display_name := CASE
        WHEN v_system = 'vedic' THEN 'Vedic Astrology (Jyotish)'
        WHEN v_system = 'western' THEN 'Western Astrology'
        WHEN v_system = 'kabbalah' THEN 'Kabbalah'
        WHEN v_system = 'numerology' THEN 'Numerology'
        WHEN v_system = 'i_ching' THEN 'I Ching'
        ELSE v_system
      END;

      -- Person 1
      doc_num := doc_num + 1;
      INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
      VALUES (
        NEW.id,
        doc_num,
        'text_generation',
        jsonb_build_object(
          'docNum', doc_num,
          'docType', 'person1',
          'system', v_system,
          'title', v_display_name || ' - ' || v_person1_name
        ),
        'pending'
      );

      -- Person 2
      doc_num := doc_num + 1;
      INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
      VALUES (
        NEW.id,
        doc_num,
        'text_generation',
        jsonb_build_object(
          'docNum', doc_num,
          'docType', 'person2',
          'system', v_system,
          'title', v_display_name || ' - ' || v_person2_name
        ),
        'pending'
      );

      -- Overlay
      doc_num := doc_num + 1;
      INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
      VALUES (
        NEW.id,
        doc_num,
        'text_generation',
        jsonb_build_object(
          'docNum', doc_num,
          'docType', 'overlay',
          'system', v_system,
          'title', v_display_name || ' - ' || v_person1_name || ' & ' || v_person2_name
        ),
        'pending'
      );
    END LOOP;

    -- Verdict (docNum 16)
    doc_num := 16;
    INSERT INTO job_tasks (job_id, sequence, task_type, input, status)
    VALUES (
      NEW.id,
      doc_num,
      'text_generation',
      jsonb_build_object(
        'docNum', doc_num,
        'docType', 'verdict',
        'system', NULL,
        'title', 'Verdict - ' || v_person1_name || ' & ' || v_person2_name
      ),
      'pending'
    );

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER auto_create_job_tasks_trigger
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION auto_create_job_tasks();

-- Migration info
COMMENT ON FUNCTION auto_create_job_tasks() IS 'Auto-generated from src/config/systemConfig.ts - DO NOT EDIT MANUALLY';
