-- Reset all stuck tasks to pending
UPDATE job_tasks
SET status = 'pending', 
    attempts = 0,
    started_at = NULL,
    completed_at = NULL
WHERE status IN ('processing', 'pending')
  AND job_id IN (
    SELECT id FROM jobs 
    WHERE status IN ('pending', 'processing')
    AND created_at > NOW() - INTERVAL '24 hours'
  );

-- Show status
SELECT 
  j.id,
  j.type,
  j.status as job_status,
  COUNT(t.id) as total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'pending') as pending,
  COUNT(t.id) FILTER (WHERE t.status = 'processing') as processing,
  COUNT(t.id) FILTER (WHERE t.status = 'complete') as complete,
  COUNT(t.id) FILTER (WHERE t.status = 'failed') as failed
FROM jobs j
LEFT JOIN job_tasks t ON t.job_id = j.id
WHERE j.created_at > NOW() - INTERVAL '24 hours'
GROUP BY j.id, j.type, j.status
ORDER BY j.created_at DESC;
