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
export declare const SYSTEMS: Record<string, SystemMetadata>;
/**
 * Get display name for a system slug
 * @example getSystemDisplayName('vedic') → 'Vedic Astrology (Jyotish)'
 */
export declare function getSystemDisplayName(slug: string): string;
/**
 * Get short name for a system slug
 * @example getSystemShortName('vedic') → 'Vedic'
 */
export declare function getSystemShortName(slug: string): string;
/**
 * Get all system slugs
 */
export declare function getAllSystemSlugs(): string[];
/**
 * Validate if a system slug exists
 */
export declare function isValidSystem(slug: string): boolean;
/**
 * SQL CASE statement for database triggers
 * Generates: CASE WHEN system = 'vedic' THEN 'Vedic Astrology (Jyotish)' ... END
 */
export declare function generateSystemCaseStatement(columnName?: string): string;
//# sourceMappingURL=systemConfig.d.ts.map