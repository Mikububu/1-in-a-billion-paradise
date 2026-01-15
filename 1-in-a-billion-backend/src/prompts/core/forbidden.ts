/**
 * FORBIDDEN PHRASES
 * 
 * These phrases MUST NEVER appear in any output.
 * They signal "AI slop" and break the literary voice.
 * 
 * Source: Michael's gold prompt documents
 */

export const FORBIDDEN_PHRASES = [
  // Meta-commentary (breaks immersion)
  'This is not just',
  'This is not about',
  'But here\'s the thing',
  'Here\'s what\'s really happening',
  'Let me show you',
  'Now here\'s where it gets interesting',
  'The truth is',
  'What most people don\'t realize',
  
  // AI corporate speak
  'It\'s important to note',
  'It\'s worth mentioning',
  'In conclusion',
  'To summarize',
  'As we can see',
  'Moving forward',
  'At the end of the day',
  
  // Spiritual bypassing
  'Everything happens for a reason',
  'It\'s all part of the journey',
  'Trust the process',
  'The universe has a plan',
  
  // Fortune-telling language
  'You will find',
  'You will meet',
  'In the future you will',
  'Destiny awaits',
  
  // Repetitive LLM patterns (synastry readings)
  'two distinct ecosystems',
  'ecosystems collide',
  'distinct ecosystems',
  'two worlds collide',
  'when two worlds',
  'dance of opposites',
  'cosmic dance',
  'tapestry of',
  'rich tapestry',
  'woven tapestry',
];

/**
 * Additional forbidden phrases for Spicy Surreal style
 * These sanitize language that should be raw
 */
export const FORBIDDEN_PHRASES_SPICY = [
  'intimate relations',    // Say what it actually is
  'physical intimacy',     // Be direct
  'challenges',            // Say WOUNDS, TRAPS, ABYSSES
  'growth opportunity',    // Say the danger directly
  'learning experience',   // Call it what it is
];

/**
 * Build the forbidden phrases section of a prompt
 */
export function buildForbiddenSection(style: 'production' | 'spicy_surreal'): string {
  const base = FORBIDDEN_PHRASES.map(p => `❌ "${p}..."`).join('\n');
  const symbols = `❌ Any decorative symbols / glyphs / emojis (examples: ★ ✦ ✨ • → ✓ ✧ ☉ ॐ). Use plain ASCII punctuation only.`;
  
  if (style === 'spicy_surreal') {
    const extra = FORBIDDEN_PHRASES_SPICY.map(p => `❌ "${p}" (be direct)`).join('\n');
    return `
FORBIDDEN PHRASES (NEVER USE THESE):
${base}
${extra}
❌ Any corporate/safe/sanitized language
${symbols}
`;
  }
  
  return `
FORBIDDEN PHRASES (NEVER USE THESE):
${base}
${symbols}
`;
}
