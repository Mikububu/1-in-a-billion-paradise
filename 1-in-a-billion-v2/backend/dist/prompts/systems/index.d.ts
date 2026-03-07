/**
 * SYSTEMS INDEX
 *
 * Exports all astrological system modules and provides system selection.
 */
export { WESTERN_SYSTEM, buildWesternSection } from './western';
export { VEDIC_SYSTEM, buildVedicSection } from './vedic';
export { GENE_KEYS_SYSTEM, buildGeneKeysSection } from './gene-keys';
export { HUMAN_DESIGN_SYSTEM, buildHumanDesignSection } from './human-design';
export { KABBALAH_SYSTEM, buildKabbalahSection } from './kabbalah';
export type AstroSystem = 'western' | 'vedic' | 'gene_keys' | 'human_design' | 'kabbalah';
export declare const ALL_SYSTEMS: AstroSystem[];
export declare const SYSTEM_DISPLAY_NAMES: Record<AstroSystem, string>;
/**
 * Get system configuration by name
 */
export declare function getSystemConfig(system: AstroSystem): {
    name: string;
    individualCoverage: string;
    synastryAdditions: string;
    emphasis: string;
    avoid: string;
};
/**
 * Build system guidance section for a single system
 */
export declare function buildSystemSection(system: AstroSystem, isRelationship: boolean, spiceLevel?: number): string;
/**
 * Build combined system guidance for all 5 systems (Nuclear)
 */
export declare function buildAllSystemsSection(isRelationship: boolean, spiceLevel: number): string;
//# sourceMappingURL=index.d.ts.map