import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_NEXT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sqlQuery = `
CREATE OR REPLACE FUNCTION auto_create_job_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_sequence INT := 1;
  v_system TEXT;
  v_systems TEXT[];
  v_doc_num INT := 1;
BEGIN
  -- ═════════════════════════════════════════════════════════════════════════
  -- BUNDLE_VERDICT: Nuclear equivalent but without the stigmatized name
  -- ═════════════════════════════════════════════════════════════════════════
  IF NEW.type = 'bundle_verdict' THEN
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

  -- ═════════════════════════════════════════════════════════════════════════
  -- NUCLEAR (legacy)
  -- ═════════════════════════════════════════════════════════════════════════
  ELSIF NEW.type = 'nuclear_v2' OR NEW.type = 'nuclear' THEN
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

async function run() {
    console.log("Applying auto_create_job_tasks migration...");

    // Note: we might not be able to execute raw SQL directly if the client doesn't 
    // expose it unless there's an exec_sql rpc. 
    // Another option is to use pg directly if SUPABASE_DB_URL is available.
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlQuery });

    if (error) {
        console.error("RPC exec_sql failed, trying without param names...", error.message);
        const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql_query: sqlQuery });
        if (e2) {
            console.error("Execute SQL failed:", e2.message);
            // Fallback logic could go here to connect via 'pg' driver
        } else {
            console.log("Success with execute_sql RPC.");
        }
    } else {
        console.log("Success!");
    }
}

run();
