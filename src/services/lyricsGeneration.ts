/**
 * LYRICS GENERATION SERVICE
 * 
 * Generates personalized song lyrics from deep reading data using DeepSeek.
 * Lyrics include the person's name and reflect their soul themes, emotional patterns,
 * fears, desires, and life direction extracted from the reading.
 */

import { llm } from './llm';
import { PersonData } from '../prompts';
import fs from 'fs';
import path from 'path';

export interface LyricsGenerationInput {
  personName: string;
  readingText: string; // Text from the reading document
  relationshipContext?: string; // Optional context for relationship readings
  systemContext?: string; // Which astrological system (e.g., "Western", "Vedic")
}

export interface LyricsResult {
  lyrics: string;
  title: string;
  style: string;
  // NEW: LLM decides the perfect music style (70s/80s psychological pipeline)
  musicStyle: string; // "70s piano ballad", "80s power rock", etc.
  vocalist: string; // "Female (Carole King)", "Male (Bruce Springsteen)", etc.
  emotion: string; // "melancholic", "triumphant", "chaotic"
  minimaxPrompt: string; // Custom prompt LLM creates for Minimax
}

/**
 * Load system-specific music prompt from MD file
 */
function loadMusicPrompt(system: string): string {
  const systemMap: Record<string, string> = {
    western: 'western-music-prompt.md',
    vedic: 'vedic-music-prompt.md',
    'human_design': 'human-design-music-prompt.md',
    'gene_keys': 'gene-keys-music-prompt.md',
    kabbalah: 'kabbalah-music-prompt.md',
    // verdict: 'final-verdict-music-prompt.md', // TODO: Add verdict prompt
  };

  const fileName = systemMap[system] || systemMap['western']; // Default to Western
  const promptPath = path.join(__dirname, '../../prompts/music', fileName);

  try {
    if (fs.existsSync(promptPath)) {
      const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
      console.log(`🎵 Loaded music prompt for ${system} from ${fileName}`);
      return promptTemplate;
    } else {
      console.warn(`⚠️ Music prompt file not found: ${promptPath}, using Western default`);
      return fs.readFileSync(path.join(__dirname, '../../prompts/music/western-music-prompt.md'), 'utf-8');
    }
  } catch (err) {
    console.error(`❌ Failed to load music prompt for ${system}:`, err);
    // Fallback to hardcoded Western prompt if file read fails
    return DEFAULT_WESTERN_PROMPT;
  }
}

const DEFAULT_WESTERN_PROMPT = `You are a masterful songwriter in the quiet, poetic tradition of Leonard Cohen, Tom Waits, Bob Dylan, and John Prine. You write INTROSPECTIVE SONGS that capture human struggle, chaos, and transformation - music to listen to while reading, not pop music.`;

/**
 * Generate personalized song lyrics from reading data
 */
export async function generateLyrics(input: LyricsGenerationInput): Promise<LyricsResult> {
  const { personName, readingText, relationshipContext, systemContext } = input;

  // Extract key themes from reading (first 5000 chars to avoid token limits)
  const readingExcerpt = readingText.substring(0, 5000);
  
  // Load system-specific music prompt from MD file
  const system = (systemContext || 'western').toLowerCase().replace(/ /g, '_');
  const promptTemplate = loadMusicPrompt(system);
  
  // Replace placeholders in template
  const prompt = promptTemplate
    .replace(/\{personName\}/g, personName)
    .replace(/\{readingExcerpt\}/g, readingExcerpt);

  try {
    const response = await llm.generate(prompt, 'lyrics-generation', {
      maxTokens: 2000, // Increased for JSON + detailed prompt
      temperature: 0.85, // Creative for music style decision
    });

    if (!response) {
      throw new Error('No lyrics generated');
    }

    console.log('🎵 LLM Response (first 500 chars):', response.substring(0, 500));
    console.log('🎵 LLM Response (last 200 chars):', response.substring(Math.max(0, response.length - 200)));

    // Extract JSON from response - try multiple strategies
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    
    // If no match, try to find JSON wrapped in markdown code blocks
    if (!jsonMatch) {
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]];
      }
    }
    
    // If still no match, try to find JSON after common prefixes
    if (!jsonMatch) {
      const afterPrefixMatch = response.match(/(?:Here|Here's|JSON|Response):\s*(\{[\s\S]*\})/i);
      if (afterPrefixMatch) {
        jsonMatch = [afterPrefixMatch[1]];
      }
    }
    
    if (!jsonMatch) {
      console.error('❌ No JSON found in LLM response');
      console.error('❌ Full response:', response);
      throw new Error('LLM did not return valid JSON');
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError.message);
      console.error('❌ JSON string:', jsonMatch[0].substring(0, 500));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }

    // Validate required fields
    if (!result.lyrics || !result.minimaxPrompt) {
      console.error('❌ Missing required fields in JSON:', result);
      throw new Error('LLM response missing required fields (lyrics or minimaxPrompt)');
    }

    console.log('✅ Lyrics generated successfully:');
    console.log(`   Title: ${result.title || 'Untitled'}`);
    console.log(`   Music Style: ${result.musicStyle || 'unknown'}`);
    console.log(`   Vocalist: ${result.vocalist || 'unknown'}`);
    console.log(`   Emotion: ${result.emotion || 'unknown'}`);
    console.log(`   Minimax Prompt: ${result.minimaxPrompt?.substring(0, 100)}...`);

    return {
      lyrics: String(result.lyrics).trim(),
      title: String(result.title || `${personName}'s Song`).trim(),
      style: String(result.musicStyle || 'pop').trim(),
      musicStyle: String(result.musicStyle || '70s pop').trim(),
      vocalist: String(result.vocalist || 'Female').trim(),
      emotion: String(result.emotion || 'emotional').trim(),
      minimaxPrompt: String(result.minimaxPrompt).trim(),
    };
  } catch (error: any) {
    console.error('❌ Lyrics generation failed:', error);
    throw new Error(`Failed to generate lyrics: ${error.message}`);
  }
}

