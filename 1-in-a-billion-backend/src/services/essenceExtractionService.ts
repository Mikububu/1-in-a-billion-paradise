/**
 * Essence Extraction Service
 * 
 * Extracts key identifiers (essences) from astrological reading texts.
 * These essences are stored in Supabase and used for:
 * 1. UI display under system names
 * 2. Future large-scale matching algorithms
 * 3. Search and filtering
 * 
 * See: docs/SYSTEM_ESSENCES.md
 */

export interface SystemEssences {
  western?: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
  };
  vedic?: {
    nakshatra: string;
    pada?: number;
    lagna: string;
    moonSign?: string;
  };
  humanDesign?: {
    type: string;
    profile: string;
  };
  geneKeys?: {
    lifesWork: number;
    evolution?: number;
  };
  kabbalah?: {
    primarySephirah?: string;
  };
  verdict?: null;
}

/**
 * Extract Vedic essences from reading text
 * Looks for: Nakshatra, Pada, Lagna, Moon sign
 */
export function extractVedicEssences(readingText: string): SystemEssences['vedic'] | null {
  if (!readingText) return null;

  const result: any = {};

  // Extract Nakshatra - patterns like "Magha Nakshatra", "in Ashwini", "Moon dwells in Bharani"
  const nakshatraMatch = readingText.match(
    /(?:in |dwells in |Moon.*?in |Nakshatra[:\s]+)([A-Z][a-z]+)\s*(?:Nakshatra)?/i
  );
  if (nakshatraMatch && !['The', 'Your', 'This', 'In', 'A', 'An'].includes(nakshatraMatch[1])) {
    result.nakshatra = nakshatraMatch[1];
  }

  // Extract Pada - patterns like "Pada 2", "second pada", "pada 1"
  const padaMatch = readingText.match(/pada\s+(\d)/i) || 
                    readingText.match(/(\d)(?:st|nd|rd|th)\s+pada/i) ||
                    readingText.match(/pada\s+(one|two|three|four)/i);
  if (padaMatch) {
    const padaStr = padaMatch[1].toLowerCase();
    const padaMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, 'one': 1, 'two': 2, 'three': 3, 'four': 4 };
    result.pada = padaMap[padaStr] || parseInt(padaStr, 10);
  }

  // Extract Lagna - patterns like "Lagna in Scorpio", "Scorpio Lagna", "Ascendant in Cancer"
  const lagnaMatch = readingText.match(/Lagna\s+(?:is |in\s+)?([A-Z][a-z]+)/i) ||
                     readingText.match(/([A-Z][a-z]+)\s+Lagna/i) ||
                     readingText.match(/Ascendant\s+is\s+(?:in\s+)?([A-Z][a-z]+)/i);
  if (lagnaMatch && !['The', 'Your', 'This'].includes(lagnaMatch[1])) {
    result.lagna = lagnaMatch[1];
  }

  // Extract Moon sign (Chandra) - patterns like "Moon in Leo", "Chandra in Taurus"
  const moonMatch = readingText.match(/(?:Moon|Chandra)\s+(?:is |in\s+|sign[:\s]+)?([A-Z][a-z]+)/i);
  if (moonMatch && !['The', 'Your', 'This'].includes(moonMatch[1])) {
    result.moonSign = moonMatch[1];
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract Human Design essences from reading text
 * Looks for: Type and Profile
 */
export function extractHumanDesignEssences(readingText: string): SystemEssences['humanDesign'] | null {
  if (!readingText) return null;

  const result: any = {};

  // Extract Type - patterns like "You are a Generator", "Manifesting Generator", "Projector", etc.
  const typeMatch = readingText.match(
    /(?:You are a |Your type is |as a )(Manifesting Generator|Generator|Projector|Manifestor|Reflector)/i
  ) || readingText.match(
    /(Manifesting Generator|Generator|Projector|Manifestor|Reflector)\s+type/i
  );
  if (typeMatch) {
    result.type = typeMatch[1];
  }

  // Extract Profile - patterns like "3/5 Profile", "Your Profile is 2/4", "Profile: 1/3"
  const profileMatch = readingText.match(/Profile[:\s]+(\d\/\d)/i) ||
                       readingText.match(/(\d\/\d)\s+Profile/i) ||
                       readingText.match(/Your.*?(\d\/\d)/);
  if (profileMatch) {
    result.profile = profileMatch[1];
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract Gene Keys essences from reading text
 * Looks for: Life's Work and Evolution gene key numbers
 */
export function extractGeneKeysEssences(readingText: string): SystemEssences['geneKeys'] | null {
  if (!readingText) return null;

  const result: any = {};

  // Extract Life's Work - patterns like "Life's Work is Gene Key 25", "GK 25", "Gene Key 25"
  const lifesWorkMatch = readingText.match(/Life'?s Work.*?(?:Gene Key |GK )(\d+)/i) ||
                         readingText.match(/Gene Key (\d+).*?Life'?s Work/i);
  if (lifesWorkMatch) {
    result.lifesWork = parseInt(lifesWorkMatch[1], 10);
  }

  // Extract Evolution - patterns like "Evolution: Gene Key 46", "Evolution is GK 46"
  const evolutionMatch = readingText.match(/Evolution.*?(?:Gene Key |GK )(\d+)/i);
  if (evolutionMatch) {
    result.evolution = parseInt(evolutionMatch[1], 10);
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract Kabbalah essences from reading text
 * Looks for: Primary Sephirah
 */
export function extractKabbalahlahEssences(readingText: string): SystemEssences['kabbalah'] | null {
  if (!readingText) return null;

  const result: any = {};

  // Extract primary Sephirah - patterns like "primary Sephirah is Chesed", "embody Gevurah"
  const sephirahMatch = readingText.match(/(?:primary )?Sephirah.*?(?:is |: )([A-Z][a-z]+)/i) ||
                        readingText.match(/embody ([A-Z][a-z]+)/i);
  if (sephirahMatch) {
    result.primarySephirah = sephirahMatch[1];
  }

  // Extract Gematria - patterns like "Gematria is 456", "Value: 456"
  const gematriaMatch = readingText.match(/Gematria.*?(?:is |: )(\d+)/i) ||
                        readingText.match(/Value: (\d+)/i);
  if (gematriaMatch) {
    result.gematria = parseInt(gematriaMatch[1], 10);
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract all essences from a complete set of readings
 * 
 * @param readingsBySystem - Object with system IDs as keys and reading text as values
 * @returns Complete essences object ready to save to Supabase
 */
export function extractAllEssences(readingsBySystem: Record<string, string>): SystemEssences {
  const essences: SystemEssences = {};

  if (readingsBySystem.vedic) {
    const vedic = extractVedicEssences(readingsBySystem.vedic);
    if (vedic) essences.vedic = vedic;
  }

  if (readingsBySystem.human_design) {
    const hd = extractHumanDesignEssences(readingsBySystem.human_design);
    if (hd) essences.humanDesign = hd;
  }

  if (readingsBySystem.gene_keys) {
    const gk = extractGeneKeysEssences(readingsBySystem.gene_keys);
    if (gk) essences.geneKeys = gk;
  }

  if (readingsBySystem.kabbalah) {
    const kab = extractKabbalahlahEssences(readingsBySystem.kabbalah);
    if (kab) essences.kabbalah = kab;
  }

  // Western essences should already be in person.placements, no need to extract
  // Verdict has no essences by design

  return essences;
}

/**
 * Generate essences directly from deterministic placements
 * This is the MOST RELIABLE source for essences.
 */
export function generateEssencesFromPlacements(placements: any): SystemEssences {
  const essences: SystemEssences = {};

  // Western
  if (placements.sunSign && placements.moonSign && placements.risingSign) {
    essences.western = {
      sunSign: placements.sunSign,
      moonSign: placements.moonSign,
      risingSign: placements.risingSign,
    };
  }

  // Vedic
  if (placements.sidereal) {
    const sid = placements.sidereal;
    essences.vedic = {
      nakshatra: sid.janmaNakshatra,
      pada: sid.janmaPada,
      lagna: sid.lagnaSign,
      moonSign: sid.chandraRashi,
    };
  }

  // Human Design / Gene Keys
  // Note: These currently require the specific HD/GK calculation logic.
  // For now, extraction from text is okay for these as they are less prone to basic sign errors.

  return essences;
}
