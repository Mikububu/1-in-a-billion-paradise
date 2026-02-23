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

/**
 * Get the LLM system prompt for a given style and doc type.
 * This is the "system" message sent to the LLM API, not the user prompt.
 */
export function getSystemPromptForStyle(
  style: StyleName,
  docType: 'individual' | 'overlay' | 'verdict' = 'individual',
): string {
  const config = getStyleConfig(style);

  if (docType === 'overlay') {
    // Overlay readings use a witness/collision framing
    if (style === 'spicy_surreal') {
      return `You are a witness to a collision between two souls. You report what you saw.

This is a dark fairytale for adults. A mystery theater of longing and obsession.
Intimate, penetrating, unforgettable. The beautiful and the unsettling intertwined.

Write like a novelist who has watched this exact collision before, in different bodies across different centuries.
Every chart overlay is a story of two fields of desire colliding.`;
    }
    return `You are a witness to a collision between two souls. You report what you saw.

This is a fairytale for adults. A mystery theater of longing and obsession.
Every chart overlay is a story of two fields of energy meeting.
Write as a storyteller who sees the invisible architecture of a connection.`;
  }

  // Individual and verdict use the style's core system prompt
  return config.systemPrompt;
}
