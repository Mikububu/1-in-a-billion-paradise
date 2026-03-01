-- Add bundle_verdict to job_type enum
-- Required for "Complete Reading" (all 5 systems) verdict generation
-- The code already sends this value but the DB enum was never updated

ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'bundle_verdict';
