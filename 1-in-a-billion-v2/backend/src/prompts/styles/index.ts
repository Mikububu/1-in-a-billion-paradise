/**
 * STYLES INDEX
 * 
 * Exports all writing style modules and provides style selection.
 */

import { PRODUCTION_STYLE, buildProductionStyleSection } from './production';
import { SPICY_SURREAL_STYLE, buildSpicySurrealStyleSection } from './spicy-surreal';

export { PRODUCTION_STYLE, buildProductionStyleSection } from './production';
export { SPICY_SURREAL_STYLE, buildSpicySurrealStyleSection } from './spicy-surreal';

export type StyleName = 'production' | 'spicy_surreal';

/**
 * Get style configuration by name
 */
export function getStyleConfig(style: StyleName) {
  switch (style) {
    case 'production':
      return PRODUCTION_STYLE;
    case 'spicy_surreal':
      return SPICY_SURREAL_STYLE;
    default:
      return PRODUCTION_STYLE;
  }
}

/**
 * Build style section for prompt
 */
export function buildStyleSection(style: StyleName): string {
  switch (style) {
    case 'production':
      return buildProductionStyleSection();
    case 'spicy_surreal':
      return buildSpicySurrealStyleSection();
    default:
      return buildProductionStyleSection();
  }
}

/**
 * Get shadow emphasis percentage for style
 */
export function getShadowEmphasis(style: StyleName): number {
  const config = getStyleConfig(style);
  return config.shadowEmphasis;
}
