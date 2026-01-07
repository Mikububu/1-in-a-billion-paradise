/**
 * SPICE LEVELS
 * 
 * 1-10 scale affecting shadow emphasis, directness, and content intensity.
 * Different calibrations for Production vs Spicy Surreal styles.
 * 
 * Source: Michael's gold prompt documents
 */

import { StyleName } from '../styles';

export type SpiceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface SpiceConfig {
  level: SpiceLevel;
  name: string;
  shadowPercent: number;
  description: string;
  instructions: string;
}

/**
 * Production style spice configurations
 */
export const PRODUCTION_SPICE: Record<string, SpiceConfig> = {
  safe: {
    level: 2,
    name: 'SAFE',
    shadowPercent: 15,
    description: 'Gentle, encouraging, growth-focused',
    instructions: `
SPICE LEVEL 1-2 - SAFE:
- Gentle, encouraging, growth-focused
- Emphasize potential and gifts
- Shadow work framed as opportunity
- Soft but honest language
- Shadow emphasis: 15%
`,
  },
  balanced: {
    level: 4,
    name: 'BALANCED',
    shadowPercent: 20,
    description: 'Honest but compassionate',
    instructions: `
SPICE LEVEL 3-4 - BALANCED:
- Honest but compassionate
- Direct about challenges
- Balance shadow with light
- Truth with care
- Shadow emphasis: 20%
`,
  },
  honest: {
    level: 6,
    name: 'HONEST',
    shadowPercent: 28,
    description: 'Brutally honest, no sugarcoating',
    instructions: `
SPICE LEVEL 5-6 - HONEST:
- Brutally honest, no sugarcoating
- Call out patterns directly
- Don't soften the shadow
- Truth over comfort
- Shadow emphasis: 25-30%
`,
  },
  raw: {
    level: 8,
    name: 'RAW',
    shadowPercent: 35,
    description: 'Raw, dark, occasionally shocking',
    instructions: `
SPICE LEVEL 7-8 - RAW:
- Raw, dark, occasionally shocking
- Show the abyss fully
- Addiction, manipulation, destruction patterns
- Make them uncomfortable with truth
- Shadow emphasis: 35%
`,
  },
  nuclear: {
    level: 10,
    name: 'NUCLEAR',
    shadowPercent: 45,
    description: 'Absolutely unfiltered, nuclear honesty',
    instructions: `
SPICE LEVEL 9-10 - NUCLEAR:
- Absolutely unfiltered, nuclear honesty
- Scorched earth truth-telling
- Nothing held back
- The full darkness AND the full light
- Include Vedic Maraka analysis if applicable
- Shadow emphasis: 40-50%
`,
  },
};

/**
 * Spicy Surreal style spice configurations (defaults higher)
 */
export const SPICY_SURREAL_SPICE: Record<string, SpiceConfig> = {
  gentle: {
    level: 3,
    name: 'GENTLE (Still Honest)',
    shadowPercent: 25,
    description: 'Still honest, gentler expression',
    instructions: `
SPICE LEVEL 1-3 - Still honest, gentler:
- Psychological depth, less graphic
- "Physical intimacy reveals their core patterns. He analyzes when he should feel. She protects when she should open."
- Shadow emphasis: 25%
`,
  },
  moderate: {
    level: 6,
    name: 'MODERATE',
    shadowPercent: 35,
    description: 'Toned down but stays honest',
    instructions: `
SPICE LEVEL 4-6 - Tone down but stay honest:
- Still psychological depth, less explicit
- "In bed, something breaks down. His need to perfect the act wars with her need to feel safe enough to actually be present."
- Shadow emphasis: 35%
`,
  },
  full: {
    level: 10,
    name: 'FULL DEPTH',
    shadowPercent: 45,
    description: 'Maximum depth - raw psychological storytelling',
    instructions: `
SPICE LEVEL 7-10 - Full Depth:
- Write about intimacy with raw psychological honesty
- Bodies as consciousness, desire as existential act
- Power dynamics raw and explicit
- "The raw animal collision of need meeting need, bodies speaking what words cannot..."
- Shadow emphasis: 40-50%
`,
  },
};

/**
 * Get spice configuration for a given level and style
 */
export function getSpiceConfig(level: SpiceLevel, style: StyleName): SpiceConfig {
  if (style === 'spicy_surreal') {
    if (level <= 3) return SPICY_SURREAL_SPICE.gentle!;
    if (level <= 6) return SPICY_SURREAL_SPICE.moderate!;
    return SPICY_SURREAL_SPICE.full!;
  }
  
  // Production style
  if (level <= 2) return PRODUCTION_SPICE.safe!;
  if (level <= 4) return PRODUCTION_SPICE.balanced!;
  if (level <= 6) return PRODUCTION_SPICE.honest!;
  if (level <= 8) return PRODUCTION_SPICE.raw!;
  return PRODUCTION_SPICE.nuclear!;
}

/**
 * Build spice level section for prompt
 */
export function buildSpiceSection(level: SpiceLevel, style: StyleName): string {
  const config = getSpiceConfig(level, style);
  
  return `
═══════════════════════════════════════════════════════════════════════════════
INTENSITY CALIBRATION: Level ${level}/10 (${config.name})
═══════════════════════════════════════════════════════════════════════════════

${config.instructions}

Calibrate your language, shadow depth, and directness to this level.
`;
}

/**
 * Get shadow percentage for level and style
 */
export function getShadowPercent(level: SpiceLevel, style: StyleName): number {
  const config = getSpiceConfig(level, style);
  return config.shadowPercent;
}
