/**
 * SPICE LEVELS
 * 
 * Type definitions and utility functions for spice level handling.
 * Full spice calibration instructions are in the MD file (Part 12).
 */

export type SpiceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StyleName = 'production' | 'spicy_surreal';

export interface SpiceConfig {
  level: SpiceLevel;
  shadowPercent: number;
  instructions: string;
}

/**
 * Get shadow percentage based on spice level.
 */
export function getShadowPercent(level: SpiceLevel, _style?: StyleName): number {
  if (level <= 3) return 25;
  if (level <= 6) return 35;
  return 45; // 7-10
}

/**
 * Get spice configuration
 */
export function getSpiceConfig(level: SpiceLevel, _style?: StyleName): SpiceConfig {
  const shadowPercent = getShadowPercent(level);
  return {
    level,
    shadowPercent,
    instructions: `Spice level ${level}/10. Shadow emphasis: ${shadowPercent}%.`
  };
}

/**
 * Build spice section for prompt
 */
export function buildSpiceSection(level: SpiceLevel, _style?: StyleName): string {
  const shadowPercent = getShadowPercent(level);
  
  let intensity = 'GENTLE';
  if (level >= 7) intensity = 'FULL DEPTH';
  else if (level >= 4) intensity = 'MODERATE';
  
  return `
═══════════════════════════════════════════════════════════════════════════════
INTENSITY: Level ${level}/10 (${intensity})
═══════════════════════════════════════════════════════════════════════════════

Shadow emphasis: ${shadowPercent}%
${level >= 7 ? 'Sex content: direct, specific, unflinching.' : 
  level >= 4 ? 'Sex content: direct but not graphic.' : 
  'Sex content: implied, psychological.'}
`;
}
