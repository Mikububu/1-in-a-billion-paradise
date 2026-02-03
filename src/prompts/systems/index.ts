/**
 * SYSTEMS INDEX
 * 
 * Exports all astrological system modules and provides system selection.
 */

import { buildWesternSection, WESTERN_SYSTEM } from './western';
import { buildVedicSection, VEDIC_SYSTEM } from './vedic';
import { buildGeneKeysSection, GENE_KEYS_SYSTEM } from './gene-keys';
import { buildHumanDesignSection, HUMAN_DESIGN_SYSTEM } from './human-design';
import { buildKabbalahSection, KABBALAH_SYSTEM } from './kabbalah';

export { WESTERN_SYSTEM, buildWesternSection } from './western';
export { VEDIC_SYSTEM, buildVedicSection } from './vedic';
export { GENE_KEYS_SYSTEM, buildGeneKeysSection } from './gene-keys';
export { HUMAN_DESIGN_SYSTEM, buildHumanDesignSection } from './human-design';
export { KABBALAH_SYSTEM, buildKabbalahSection } from './kabbalah';

export type AstroSystem = 'western' | 'vedic' | 'gene_keys' | 'human_design' | 'kabbalah';

export const ALL_SYSTEMS: AstroSystem[] = ['western', 'vedic', 'gene_keys', 'human_design', 'kabbalah'];

export const SYSTEM_DISPLAY_NAMES: Record<AstroSystem, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology (Jyotish)',
  gene_keys: 'Gene Keys',
  human_design: 'Human Design',
  kabbalah: 'Kabbalistic Astrology',
};

/**
 * Get system configuration by name
 */
export function getSystemConfig(system: AstroSystem) {
  switch (system) {
    case 'western':
      return WESTERN_SYSTEM;
    case 'vedic':
      return VEDIC_SYSTEM;
    case 'gene_keys':
      return GENE_KEYS_SYSTEM;
    case 'human_design':
      return HUMAN_DESIGN_SYSTEM;
    case 'kabbalah':
      return KABBALAH_SYSTEM;
  }
}

/**
 * Build system guidance section for a single system
 */
export function buildSystemSection(
  system: AstroSystem, 
  isRelationship: boolean,
  spiceLevel: number = 5
): string {
  switch (system) {
    case 'western':
      return buildWesternSection(isRelationship);
    case 'vedic':
      return buildVedicSection(isRelationship, spiceLevel);
    case 'gene_keys':
      return buildGeneKeysSection(isRelationship);
    case 'human_design':
      return buildHumanDesignSection(isRelationship);
    case 'kabbalah':
      return buildKabbalahSection(isRelationship);
  }
}

/**
 * Build combined system guidance for all 5 systems (Nuclear)
 */
export function buildAllSystemsSection(isRelationship: boolean, spiceLevel: number): string {
  let section = `
═══════════════════════════════════════════════════════════════════════════════
ALL 5 SYSTEMS - SYNTHESIS REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You must analyze through ALL 5 systems and WEAVE them together.
Do NOT list systems separately. SYNTHESIZE them into one narrative.

`;

  for (const system of ALL_SYSTEMS) {
    section += buildSystemSection(system, isRelationship, spiceLevel);
    section += '\n';
  }

  return section;
}
