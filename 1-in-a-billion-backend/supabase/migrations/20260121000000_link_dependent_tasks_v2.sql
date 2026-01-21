-- Create function to link dependent tasks
CREATE OR REPLACE FUNCTION link_dependent_tasks_on_text_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_text_path TEXT;
  v_doc_num INTEGER;
  v_job_id UUID;
  v_updated_count INTEGER;
BEGIN
  IF NEW.task_type = 'text_generation' 
     AND NEW.status = 'complete' 
     AND OLD.status != 'complete'
     AND NEW.output IS NOT NULL 
     AND NEW.output->>'textArtifactPath' IS NOT NULL 
  THEN
    v_text_path := NEW.output->>'textArtifactPath';
    v_doc_num := (NEW.input->>'docNum')::INTEGER;
    v_job_id := NEW.job_id;
    
    UPDATE job_tasks
    SET input = jsonb_set(
      COALESCE(input, '{}'::jsonb),
      '{textArtifactPath}',
      to_jsonb(v_text_path)
    ),
    updated_at = now()
    WHERE job_id = v_job_id
      AND task_type = 'audio_generation'
      AND (input->>'docNum')::INTEGER = v_doc_num
      AND status = 'pending';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
      RAISE NOTICE 'Linked % audio task(s) to text artifact: %', v_updated_count, v_text_path;
    END IF;
    
    UPDATE job_tasks
    SET input = jsonb_set(
      COALESCE(input, '{}'::jsonb),
      '{textArtifactPath}',
      to_jsonb(v_text_path)
    ),
    updated_at = now()
    WHERE job_id = v_job_id
      AND task_type = 'pdf_generation'
      AND (input->>'docNum')::INTEGER = v_doc_num
      AND status = 'pending';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
      RAISE NOTICE 'Linked % PDF task(s) to text artifact: %', v_updated_count, v_text_path;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_link_dependent_tasks ON job_tasks;

CREATE TRIGGER trigger_link_dependent_tasks
  AFTER UPDATE ON job_tasks
  FOR EACH ROW
  EXECUTE FUNCTION link_dependent_tasks_on_text_complete();
