/**
 * LYRICS GENERATION SERVICE
 * 
 * Generates personalized song lyrics from deep reading data using DeepSeek.
 * Lyrics include the person's name and reflect their soul themes, emotional patterns,
 * fears, desires, and life direction extracted from the reading.
 */

import { llm } from './llm';
import fs from 'fs';
import path from 'path';

export interface LyricsGenerationInput {
  personName: string;
  readingText: string; // Text from the reading document
  relationshipContext?: string; // Optional context for relationship readings
  // Prefer passing a stable system key (prevents Western fallback)
  systemKey?: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'verdict' | 'final_verdict';
  // Legacy/optional: free-form system descriptor (e.g. "This is a vedic astrology reading.")
  systemContext?: string;
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
    verdict: 'final-verdict-music-prompt.md',
    'final_verdict': 'final-verdict-music-prompt.md',
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
  const { personName, readingText, relationshipContext, systemKey, systemContext } = input;

  // Extract key themes from reading (first 5000 chars to avoid token limits)
  const readingExcerpt = readingText.substring(0, 5000);
  
  // Load system-specific music prompt from MD file.
  // IMPORTANT: systemKey must be a stable key; do NOT derive the key from a sentence.
  const allowedSystems = [
    'western',
    'vedic',
    'human_design',
    'gene_keys',
    'kabbalah',
    'verdict',
    'final_verdict',
  ] as const;

  const normalizeSystem = (): (typeof allowedSystems)[number] => {
    if (systemKey && (allowedSystems as readonly string[]).includes(systemKey)) return systemKey;

    const raw = (systemContext || '').toLowerCase();
    // Common case: systemContext is a full sentence like "This is a vedic astrology reading."
    for (const s of allowedSystems) {
      if (raw.includes(s)) return s;
    }
    // Back-compat: handle "human design" / "gene keys" etc.
    if (raw.includes('human design')) return 'human_design';
    if (raw.includes('gene keys')) return 'gene_keys';
    if (raw.includes('final verdict') || raw.includes('verdict')) return 'verdict';
    return 'western';
  };

  const system = normalizeSystem();
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
      
      // FALLBACK: Try to extract lyrics from plain text response
      // Sometimes the LLM writes lyrics without JSON wrapper
      console.log('🔄 Attempting fallback: extracting lyrics from plain text...');
      const lines = response.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('*') && !l.includes('```'));
      if (lines.length >= 8) {
        // Looks like lyrics - use them with default settings
        console.log('✅ Fallback: Found lyrics in plain text format');
        // Generate fallback minimaxPrompt based on system
        let fallbackMinimaxPrompt = '';
        switch (system) {
          case 'vedic':
            fallbackMinimaxPrompt = 'A contemplative Indian classical fusion song. 40% Anoushka Shankar (sitar, emotional modern classical), 40% Hariprasad Chaurasia (bansuri flute, meditative flow), 20% West Bengal Kali Mantra (traditional devotional chanting). Sparse instrumentation: sitar, bansuri flute, tabla, tanpura drone. Slow tempo, introspective vocals. Music to listen to while reading - background, not foreground. Never commercial or pop-oriented.';
            break;
          case 'western':
            fallbackMinimaxPrompt = 'A quiet, introspective song in the poetic style of Leonard Cohen or Tom Waits. Sparse instrumentation - acoustic guitar or minimal piano. Contemplative, low-key vocal delivery. Music to listen to while reading - never nervous or pop-oriented.';
            break;
          case 'human_design':
            fallbackMinimaxPrompt = 'Ethereal ambient soundscape. Synthesizers, soft pads, minimal percussion. Contemplative vocals. Music to listen to while reading - background, meditative, not foreground.';
            break;
          case 'gene_keys':
            fallbackMinimaxPrompt = 'Contemplative world fusion. Blend of acoustic instruments and subtle electronics. Introspective vocals. Music to listen to while reading - background, not pop-oriented.';
            break;
          case 'kabbalah':
            fallbackMinimaxPrompt = 'Mystical Jewish-inspired music. Blend of traditional and contemporary. Contemplative vocals. Music to listen to while reading - spiritual, meditative, not commercial.';
            break;
          default:
            fallbackMinimaxPrompt = 'A quiet, introspective song. Sparse instrumentation. Contemplative vocals. Music to listen to while reading.';
        }
        
        return {
          lyrics: lines.join('\n').trim(),
          title: `${personName}'s Song`,
          style: system === 'vedic' ? 'Indian classical fusion' : '70s piano ballad',
          musicStyle: system === 'vedic' ? 'Indian classical fusion' : '70s piano ballad',
          vocalist: 'Female',
          emotion: 'contemplative',
          minimaxPrompt: fallbackMinimaxPrompt,
        };
      }
      
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
    
    // RETRY with simpler prompt that's more likely to return valid JSON
    console.log('🔄 Retrying with simplified prompt...');
    try {
      const simplePrompt = `Write a short, contemplative song for ${personName}. 

Based on this reading excerpt:
${readingExcerpt.substring(0, 2000)}

Return ONLY this JSON (no other text):
{
  "lyrics": "verse 1 line 1\\nverse 1 line 2\\nverse 1 line 3\\nverse 1 line 4\\n\\nchorus line 1\\nchorus line 2\\nchorus line 3\\nchorus line 4\\n\\nverse 2 line 1\\nverse 2 line 2\\nverse 2 line 3\\nverse 2 line 4",
  "title": "Song Title",
  "musicStyle": "${system === 'vedic' ? 'Indian classical fusion' : '70s piano ballad'}",
  "vocalist": "Female",
  "emotion": "contemplative",
  "minimaxPrompt": "${system === 'vedic' ? 'Contemplative Indian classical fusion. Sitar, bansuri flute, tabla. Slow, introspective.' : 'Quiet piano ballad in Leonard Cohen style. Acoustic, contemplative.'}"
}`;

      const retryResponse = await llm.generate(simplePrompt, 'lyrics-generation-retry', {
        maxTokens: 1500,
        temperature: 0.7,
      });

      const retryJsonMatch = retryResponse?.match(/\{[\s\S]*\}/);
      if (retryJsonMatch) {
        const retryResult = JSON.parse(retryJsonMatch[0]);
        if (retryResult.lyrics) {
          console.log('✅ Retry succeeded!');
          return {
            lyrics: String(retryResult.lyrics).trim(),
            title: String(retryResult.title || `${personName}'s Song`).trim(),
            style: String(retryResult.musicStyle || '70s piano ballad').trim(),
            musicStyle: String(retryResult.musicStyle || '70s piano ballad').trim(),
            vocalist: String(retryResult.vocalist || 'Female').trim(),
            emotion: String(retryResult.emotion || 'contemplative').trim(),
            minimaxPrompt: String(retryResult.minimaxPrompt || 'Quiet, contemplative song. Acoustic instrumentation.').trim(),
          };
        }
      }
    } catch (retryError: any) {
      console.error('❌ Retry also failed:', retryError.message);
    }
    
    throw new Error(`Failed to generate lyrics: ${error.message}`);
  }
}

