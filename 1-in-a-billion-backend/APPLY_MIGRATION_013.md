# Apply Migration 013 - Add Song Generation Task Type

## SQL to Run in Supabase Dashboard

Go to Supabase → SQL Editor and run:

```sql
-- Add song_generation to task_type enum
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'song_generation';

-- Add song artifact type
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'audio_song';
```

This will allow the workers to recognize and process song generation tasks.

---

## After Applying

The workers will be able to claim tasks without the enum error.
