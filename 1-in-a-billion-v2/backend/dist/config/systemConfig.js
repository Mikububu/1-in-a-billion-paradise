"use strict";
/**
 * SINGLE SOURCE OF TRUTH for System Names & Metadata
 *
 * All display names, slugs, and system metadata in one place.
 * Used by: workers, PDF generation, database triggers, frontend labels.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEMS = void 0;
exports.getSystemDisplayName = getSystemDisplayName;
exports.getSystemShortName = getSystemShortName;
exports.getAllSystemSlugs = getAllSystemSlugs;
exports.isValidSystem = isValidSystem;
exports.generateSystemCaseStatement = generateSystemCaseStatement;
/**
 * Master system configuration
 *
 * IMPORTANT: These display names MUST match the database trigger logic.
 * When adding a new system, update this object AND migration 009.
 */
exports.SYSTEMS = {
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
};
/**
 * Get display name for a system slug
 * @example getSystemDisplayName('vedic') → 'Vedic Astrology (Jyotish)'
 */
function getSystemDisplayName(slug) {
    return exports.SYSTEMS[slug]?.displayName || slug;
}
/**
 * Get short name for a system slug
 * @example getSystemShortName('vedic') → 'Vedic'
 */
function getSystemShortName(slug) {
    return exports.SYSTEMS[slug]?.shortName || slug;
}
/**
 * Get all system slugs
 */
function getAllSystemSlugs() {
    return Object.keys(exports.SYSTEMS);
}
/**
 * Validate if a system slug exists
 */
function isValidSystem(slug) {
    return slug in exports.SYSTEMS;
}
/**
 * SQL CASE statement for database triggers
 * Generates: CASE WHEN system = 'vedic' THEN 'Vedic Astrology (Jyotish)' ... END
 */
function generateSystemCaseStatement(columnName = 'system') {
    const cases = Object.entries(exports.SYSTEMS)
        .map(([slug, meta]) => `    WHEN ${columnName} = '${slug}' THEN '${meta.displayName}'`)
        .join('\n');
    return `CASE\n${cases}\n    ELSE ${columnName}\n  END`;
}
//# sourceMappingURL=systemConfig.js.map