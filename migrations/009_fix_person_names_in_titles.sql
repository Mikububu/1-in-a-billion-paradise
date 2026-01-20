-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Use actual person names in task titles (not generic "Person 1/2")
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This migration updates the auto_create_job_tasks trigger to extract
-- actual person names from job params and use them in task titles.
--
-- Before: "vedic - Person 1", "vedic - Person 2"
-- After:  "vedic - Akasha", "vedic - Michael"
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop and recreate the function with person name extraction
CREATE OR REPLACE FUNCTION auto_create_job_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_systems TEXT[];
  v_system TEXT;
  v_doc_num INTEGER;
  v_sequence INTEGER := 0;
  v_person1_name TEXT;
  v_person2_name TEXT;
BEGIN
  -- Only create tasks if job is newly inserted
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Extract person names from params (for title generation)
  v_person1_name := COALESCE(NEW.params->'person1'->>'name', 'Person 1');
  v_person2_name := COALESCE(NEW.params->'person2'->>'name', 'Person 2');

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
          'title', v_system || ' - ' || v_person1_name
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
          'title', v_system || ' - ' || v_person2_name
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
          'title', v_system || ' - ' || v_person1_name
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
          'title', v_system || ' - ' || v_person2_name
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

-- Ensure function has correct permissions
ALTER FUNCTION auto_create_job_tasks() SET search_path = public;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
