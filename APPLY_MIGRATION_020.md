# Apply Migration 020: Add personal_context to library_people

## ⚠️ URGENT: This migration must be applied to fix the error

The error `Could not find the 'personal_context' column of 'library_people'` occurs because this migration hasn't been applied yet.

## How to Apply

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the SQL below
6. Click **Run** (or press Cmd/Ctrl + Enter)

## SQL to Execute

```sql
-- Migration 020: Add personal_context field to library_people table
-- Purpose: Store user's personal context/life events for ANY reading system
-- This is a universal field used by all systems (Western, Vedic, Human Design, Gene Keys, Kabbalah, etc.)
-- Kabbalah uses it more extensively, but it's the same single variable for all readings

-- Add personal_context column as TEXT
ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS personal_context TEXT;

-- Add index for faster queries when filtering by personal context
CREATE INDEX IF NOT EXISTS idx_library_people_personal_context 
ON library_people(personal_context) 
WHERE personal_context IS NOT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN library_people.personal_context IS 
'User-provided personal context including surname, life events, dates, and locations. 
Used primarily for Kabbalah readings (up to 600 characters) but can be used for any reading system.
Stored as individual field for future matching algorithms and analysis.';
```

## Verification

After applying, you can verify it worked by running this query in SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'library_people' 
AND column_name = 'personal_context';
```

You should see `personal_context | text` in the results.

## File Location

The migration file is at: `supabase/migrations/020_add_personal_context_to_library_people.sql`
