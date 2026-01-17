-- ═══════════════════════════════════════════════════════════════════════════
-- COST TRACKING MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds cost tracking columns to jobs and tasks tables
-- Tracks: LLM tokens (input/output), RunPod GPU time, calculated costs

BEGIN;

-- Add cost tracking to job_tasks
ALTER TABLE job_tasks ADD COLUMN IF NOT EXISTS cost_data JSONB DEFAULT '{}';
-- cost_data structure:
-- {
--   "provider": "claude" | "deepseek" | "openai" | "runpod",
--   "model": "claude-sonnet-4-20250514",
--   "input_tokens": 1234,
--   "output_tokens": 5678,
--   "execution_time_ms": 45000,
--   "cost_usd": 0.0234
-- }

-- Add total cost to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10, 6) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '{}';
-- cost_breakdown structure:
-- {
--   "llm": { "claude": 0.15, "deepseek": 0.02, "openai": 0.05 },
--   "audio": 0.03,
--   "total": 0.25
-- }

-- Create cost_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES job_tasks(id) ON DELETE SET NULL,
  
  -- Provider info
  provider TEXT NOT NULL, -- 'claude', 'deepseek', 'openai', 'runpod'
  model TEXT,
  
  -- Usage metrics
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  execution_time_ms INTEGER DEFAULT 0,
  
  -- Cost calculation
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  
  -- Context
  label TEXT, -- e.g., 'text-western-p1', 'audio-chapter-1'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_logs_job_id ON cost_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_cost_logs_provider ON cost_logs(provider);
CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON cost_logs(created_at DESC);

-- RLS for cost_logs (service role only)
ALTER TABLE cost_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on cost_logs"
  ON cost_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to update job total cost when tasks complete
CREATE OR REPLACE FUNCTION update_job_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC(10, 6);
  v_breakdown JSONB;
BEGIN
  -- Calculate total cost from cost_logs
  SELECT 
    COALESCE(SUM(cost_usd), 0),
    jsonb_object_agg(provider, provider_cost) 
  INTO v_total, v_breakdown
  FROM (
    SELECT provider, SUM(cost_usd) as provider_cost
    FROM cost_logs
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    GROUP BY provider
  ) sub;
  
  -- Update job
  UPDATE jobs
  SET 
    total_cost_usd = v_total,
    cost_breakdown = COALESCE(v_breakdown, '{}') || jsonb_build_object('total', v_total)
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_job_cost_on_log_insert
  AFTER INSERT ON cost_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_total_cost();

-- Grant permissions
GRANT SELECT ON cost_logs TO authenticated;
GRANT ALL ON cost_logs TO service_role;

COMMIT;
