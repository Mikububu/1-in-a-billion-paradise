-- Migration 018: Add system essences to people table
-- These essences are the key identifiers for each astrological system
-- Used for display in UI and future large-scale matching algorithms

-- Add essences column as JSONB for flexible storage
ALTER TABLE people
ADD COLUMN IF NOT EXISTS essences JSONB DEFAULT '{}'::jsonb;

-- Create index for querying essences
CREATE INDEX IF NOT EXISTS idx_people_essences ON people USING GIN (essences);

-- Add comment explaining the structure
COMMENT ON COLUMN people.essences IS 'Key identifiers for each astrological system. Structure:
{
  "western": {"sunSign": "Sagittarius", "moonSign": "Cancer", "risingSign": "Scorpio"},
  "vedic": {"nakshatra": "Magha", "pada": 2, "lagna": "Scorpio", "moonSign": "Leo"},
  "humanDesign": {"type": "Manifesting Generator", "profile": "3/5"},
  "geneKeys": {"lifesWork": 25, "evolution": 46},
  "kabbalah": {"primarySephirah": "Chesed"},
  "verdict": null
}';

-- Create helper function to extract essences from western placements (backward compatibility)
CREATE OR REPLACE FUNCTION extract_western_essences(placements JSONB)
RETURNS JSONB AS $$
BEGIN
  IF placements IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'sunSign', placements->>'sunSign',
    'moonSign', placements->>'moonSign',
    'risingSign', placements->>'risingSign'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill existing western essences from placements
UPDATE people
SET essences = jsonb_set(
  COALESCE(essences, '{}'::jsonb),
  '{western}',
  extract_western_essences(placements)
)
WHERE placements IS NOT NULL
  AND placements ? 'sunSign'
  AND (essences IS NULL OR essences->>'western' IS NULL);

-- Add comment about usage
COMMENT ON TABLE people IS 'People profiles with birth data, placements, and system essences. 
Essences are key identifiers used for:
1. Quick UI display under system names
2. Future large-scale compatibility matching algorithms
3. Search and filtering by astrological characteristics';
