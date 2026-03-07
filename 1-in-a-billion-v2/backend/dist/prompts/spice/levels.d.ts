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
export declare const PRODUCTION_SPICE: Record<string, SpiceConfig>;
/**
 * Spicy Surreal style spice configurations (defaults higher)
 */
export declare const SPICY_SURREAL_SPICE: Record<string, SpiceConfig>;
/**
 * Get spice configuration for a given level and style
 */
export declare function getSpiceConfig(level: SpiceLevel, style: StyleName): SpiceConfig;
/**
 * Build spice level section for prompt
 */
export declare function buildSpiceSection(level: SpiceLevel, style: StyleName): string;
/**
 * Get shadow percentage for level and style
 */
export declare function getShadowPercent(level: SpiceLevel, style: StyleName): number;
//# sourceMappingURL=levels.d.ts.map