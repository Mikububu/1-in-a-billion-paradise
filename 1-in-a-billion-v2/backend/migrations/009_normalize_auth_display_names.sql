-- ═══════════════════════════════════════════════════════════════════════════
-- NORMALIZE AUTH DISPLAY NAMES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This migration adds a trigger to normalize display names from OAuth providers
-- (Google, Apple) to extract first name only before storing in library_people.
--
-- Logic:
-- 1. If name contains spaces, take substring before first space
-- 2. Else use the name as-is (already first name only)
-- 3. Never store full "First Last" format
--
-- This ensures consistent first-name-only storage across all auth providers.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTION: Extract first name from display name
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION extract_first_name(full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  space_pos INTEGER;
BEGIN
  -- Handle NULL or empty string
  IF full_name IS NULL OR TRIM(full_name) = '' THEN
    RETURN 'User';
  END IF;

  -- Trim whitespace
  full_name := TRIM(full_name);

  -- Find first space
  space_pos := POSITION(' ' IN full_name);

  -- If space found, return substring before it
  IF space_pos > 0 THEN
    RETURN TRIM(SUBSTRING(full_name FROM 1 FOR space_pos - 1));
  END IF;

  -- No space found, return as-is (already first name only)
  RETURN full_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: Normalize name before insert/update
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION normalize_library_people_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize name to first name only
  NEW.name := extract_first_name(NEW.name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGER: Apply normalization on library_people
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_normalize_library_people_name ON library_people;

CREATE TRIGGER trg_normalize_library_people_name
  BEFORE INSERT OR UPDATE OF name ON library_people
  FOR EACH ROW
  EXECUTE FUNCTION normalize_library_people_name();

-- ───────────────────────────────────────────────────────────────────────────
-- NORMALIZE EXISTING DATA (one-time cleanup)
-- ───────────────────────────────────────────────────────────────────────────

-- Update existing records to extract first name only
UPDATE library_people
SET name = extract_first_name(name)
WHERE name LIKE '% %'; -- Only update names with spaces

-- ───────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ───────────────────────────────────────────────────────────────────────────

ALTER FUNCTION extract_first_name(TEXT) SET search_path = public;
ALTER FUNCTION normalize_library_people_name() SET search_path = public;

-- Make extract_first_name available to authenticated users (for client-side use if needed)
GRANT EXECUTE ON FUNCTION extract_first_name(TEXT) TO authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Test the function:
-- SELECT extract_first_name('John Doe');        -- Returns: 'John'
-- SELECT extract_first_name('Jane');            -- Returns: 'Jane'
-- SELECT extract_first_name('  Bob Smith  ');   -- Returns: 'Bob'
-- SELECT extract_first_name('');                -- Returns: 'User'
-- SELECT extract_first_name(NULL);              -- Returns: 'User'

-- Test the trigger:
-- INSERT INTO library_people (user_id, client_person_id, name, is_user, birth_data)
-- VALUES (
--   auth.uid(),
--   'test-123',
--   'Michael Perin Wogenburg',
--   true,
--   '{}'::jsonb
-- );
-- 
-- SELECT name FROM library_people WHERE client_person_id = 'test-123';
-- -- Should return: 'Michael'

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
