import { HookReading, ReadingPayload } from '../../types';
import { SYSTEM_PROMPT, buildReadingPrompt, PromptContext } from './prompts';
import { llmWithFallback } from '../llm'; // Centralized LLM service with fallback
import { getLanguageInstruction, isValidLanguage, type OutputLanguage } from '../../config/languages';

// ═══════════════════════════════════════════════════════════════════════════
// READINGS CLIENT - Uses centralized LLM service (provider via LLM_PROVIDER env)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean text by removing em-dashes, Hebrew characters, and other problematic characters
 * 
 * Post-processing safety net for TTS compatibility:
 * - LLMs sometimes add em-dashes despite instructions → replace with commas
 * - Hebrew characters may slip through → strip them (prompts should prevent this via romanization)
 * 
 * Note: Prompts should instruct LLMs to write naturally with romanized letter names (Aleph, Bet, etc.)
 * This cleanup is a backup to ensure TTS never receives unpronounceble characters.
 */
function cleanText(text: string): string {
  if (!text) return text;

  return text
    // Replace em-dashes with commas
    .replace(/-/g, ',')
    // Replace en-dashes with hyphens
    .replace(/-/g, '-')
    // Remove any other unicode dashes
    .replace(/[\u2013\u2014\u2015]/g, ',')
    // SAFETY NET: Remove Hebrew characters (U+0590 to U+05FF)
    // Prompts should prevent this, but strip as backup for TTS compatibility
    .replace(/[\u0590-\u05FF]/g, '')
    // Clean up double commas
    .replace(/,\s*,/g, ',')
    // Clean up comma before period
    .replace(/,\s*\./g, '.')
    // Clean up double spaces
    .replace(/\s\s+/g, ' ')
    .trim();
}

type HookRequest = {
  type: HookReading['type'];
  sign: string;
  payload: ReadingPayload;
  placements?: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: { sign: string; degree: number; minute: number };
    moonDegree?: { sign: string; degree: number; minute: number };
    ascendantDegree?: { sign: string; degree: number; minute: number };
    sunHouse?: number;
    moonHouse?: number;
  };
};


export const readingsClient = {
  async generateHookReading(request: HookRequest): Promise<{ reading: HookReading; source: 'deepseek' | 'fallback' }> {
    const { type, sign, payload, placements } = request;

    // Build the prompt context WITH placements for exact degrees
    const ctx: PromptContext = {
      type,
      sign,
      birthDate: payload.birthDate,
      birthTime: payload.birthTime,
      birthPlace: payload.birthPlace, // City name for poetic intro
      intensity: payload.relationshipIntensity,
      mode: payload.relationshipMode,
      subjectName: payload.subjectName,
      isPartnerReading: payload.isPartnerReading,
      placements: placements ? {
        sunSign: placements.sunSign,
        moonSign: placements.moonSign,
        risingSign: placements.risingSign,
        sunDegree: placements.sunDegree,
        moonDegree: placements.moonDegree,
        ascendantDegree: placements.ascendantDegree,
        sunHouse: placements.sunHouse,
        moonHouse: placements.moonHouse,
      } : undefined,
    };

    try {
      // Use centralized LLM service with automatic fallback (REQUIREMENT #8)
      // If DeepSeek fails or refuses, automatically tries Claude, then OpenAI
      // Append language instruction for non-English hook readings (same pattern as extended readings)
      const language = payload.primaryLanguage || 'en';
      let systemPrompt = SYSTEM_PROMPT;
      if (language !== 'en' && isValidLanguage(language)) {
        const langInstruction = getLanguageInstruction(language as OutputLanguage);
        if (langInstruction) {
          systemPrompt = systemPrompt + '\n\n' + langInstruction;
        }
      }
      const fullPrompt = `${systemPrompt}\n\n${buildReadingPrompt(ctx)}`;
      const { text: rawContent, provider, usedFallback } = await llmWithFallback.generateWithFallback(
        fullPrompt,
        `hook-${type}`,
        {
          maxTokens: 500,
          temperature: 0.7,
          retriesPerProvider: 2,
        }
      );

      if (usedFallback) {
        console.log(`🔄 Hook reading [${type}] used fallback provider: ${provider}`);
      }

      const normalized = rawContent.replace(/```json|```/g, '').trim();

      try {
        const parsed = JSON.parse(normalized);
        const reading: HookReading = {
          type,
          sign,
          intro: cleanText(parsed.preamble || parsed.intro),
          main: cleanText(parsed.analysis || parsed.main),
        };
        return { reading, source: usedFallback ? 'fallback' : 'deepseek' };
      } catch (parseError) {
        console.error('Failed to parse LLM response:', normalized);
        return {
          reading: { type, sign, intro: 'Parse error', main: cleanText(rawContent) },
          source: 'fallback',
        };
      }
    } catch (error) {
      // All providers failed - this is a hard failure
      console.error('All LLM providers failed for hook reading:', error);
      return {
        reading: { type, sign, intro: 'Service temporarily unavailable', main: 'Please try again in a moment.' },
        source: 'fallback',
      };
    }
  },
};
