-- Add song_generation to task_type enum
-- This allows jobs to include song generation tasks for paid users

-- Add new task type
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'song_generation';

-- Add song artifact type
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'audio_song';

-- Note: Song generation will be added as a task after all text/PDF/audio tasks complete
-- for nuclear_v2 jobs where the user has paid for a deep soul reading

