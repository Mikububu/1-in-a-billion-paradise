/**
 * SINGLE SOURCE OF TRUTH for System Names & Metadata
 * 
 * All display names, slugs, and system metadata in one place.
 * Used by: workers, PDF generation, database triggers, frontend labels.
 */

export interface SystemMetadata {
  slug: string;
  displayName: string;
  shortName: string;
  description: string;
  icon?: string;
}

/**
 * Master system configuration
 * 
 * IMPORTANT: These display names MUST match the database trigger logic.
 * When adding a new system, update this object AND migration 009.
 */
export const SYSTEMS: Record<string, SystemMetadata> = {
  vedic: {
    slug: 'vedic',
    displayName: 'Vedic Astrology (Jyotish)',
    shortName: 'Vedic',
    description: 'Ancient Indian astrological system based on sidereal zodiac',
    icon: '🕉️',
  },
  western: {
    slug: 'western',
    displayName: 'Western Astrology',
    shortName: 'Western',
    description: 'Tropical zodiac-based astrological system',
    icon: '♈',
  },
  kabbalah: {
    slug: 'kabbalah',
    displayName: 'Kabbalah',
    shortName: 'Kabbalah',
    description: 'Jewish mystical tradition with numerology and Hebrew letters',
    icon: '✡️',
  },
  numerology: {
    slug: 'numerology',
    displayName: 'Numerology',
    shortName: 'Numerology',
    description: 'Study of numbers and their mystical significance',
    icon: '🔢',
  },
  i_ching: {
    slug: 'i_ching',
    displayName: 'I Ching',
    shortName: 'I Ching',
    description: 'Ancient Chinese divination system',
    icon: '☯️',
  },
  human_design: {
    slug: 'human_design',
    displayName: 'Human Design',
    shortName: 'Human Design',
    description: 'Synthesis of astrology, I Ching, Kabbalah, and chakra system',
    icon: '🔷',
  },
  gene_keys: {
    slug: 'gene_keys',
    displayName: 'Gene Keys',
    shortName: 'Gene Keys',
    description: 'Contemplative system derived from Human Design and I Ching',
    icon: '🧬',
  },
} as const;

/**
 * Get display name for a system slug
 * @example getSystemDisplayName('vedic') → 'Vedic Astrology (Jyotish)'
 */
export function getSystemDisplayName(slug: string): string {
  return SYSTEMS[slug]?.displayName || slug;
}

/**
 * Get short name for a system slug
 * @example getSystemShortName('vedic') → 'Vedic'
 */
export function getSystemShortName(slug: string): string {
  return SYSTEMS[slug]?.shortName || slug;
}

/**
 * Get all system slugs
 */
export function getAllSystemSlugs(): string[] {
  return Object.keys(SYSTEMS);
}

/**
 * Validate if a system slug exists
 */
export function isValidSystem(slug: string): boolean {
  return slug in SYSTEMS;
}

/**
 * SQL CASE statement for database triggers
 * Generates: CASE WHEN system = 'vedic' THEN 'Vedic Astrology (Jyotish)' ... END
 */
export function generateSystemCaseStatement(columnName: string = 'system'): string {
  const cases = Object.entries(SYSTEMS)
    .map(([slug, meta]) => `    WHEN ${columnName} = '${slug}' THEN '${meta.displayName}'`)
    .join('\n');
  
  return `CASE\n${cases}\n    ELSE ${columnName}\n  END`;
}
