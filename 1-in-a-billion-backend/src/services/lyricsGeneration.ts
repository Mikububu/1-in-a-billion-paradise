/**
 * LYRICS GENERATION SERVICE
 * 
 * Generates personalized song lyrics from deep reading data using DeepSeek.
 * Lyrics include the user's name and reflect their soul themes, emotional patterns,
 * fears, desires, and life direction extracted from the reading.
 */

import { llm } from './llm';
import { PersonData } from '../prompts';

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
 * Generate personalized song lyrics from reading data
 */
export async function generateLyrics(input: LyricsGenerationInput): Promise<LyricsResult> {
  const { personName, readingText, relationshipContext, systemContext } = input;

  // Extract key themes from reading (first 5000 chars to avoid token limits)
  const readingExcerpt = readingText.substring(0, 5000);
  
  const prompt = `You are a masterful pop songwriter with the lyrical intelligence of Paul Simon and the emotional power of Celine Dion. You write HIT SONGS that capture human struggle, chaos, and transformation.

Generate a personalized pop song for ${personName} based on their life story extracted from this reading.

**CRITICAL RULES:**
1. ❌ NO ASTROLOGY TERMS - No zodiac signs, planets, constellations, houses, aspects, chart references
2. ❌ NO "Virgo", "Moon in...", "Rising", "Stars aligned", "Cosmic", "Astrological" etc.
3. ✅ EXTRACT: Character problems, emotional chaos, life struggles, relationship patterns, fears, desires
4. ✅ MAKE IT EXPLICIT and DRAMATIC - about their LIFE and EMOTIONS, not astrology
5. ✅ The person's name (${personName}) must appear naturally in lyrics (at least once)
6. ✅ POP MUSIC STYLE - radio-ready, emotional, memorable chorus, 70s/80s inspired
7. ✅ Think: "Bridge Over Troubled Water", "My Heart Will Go On", "Someone Like You"

The reading below is JUST RAW MATERIAL to extract ${personName}'s story:
- What does ${personName} struggle with emotionally?
- What chaos do they live through?
- What relationship patterns destroy them?
- What do they fear most?
- What do they hide from others?
- What makes them feel alive or dead inside?

**Reading Excerpt (Use as research only, don't quote astrological terms):**
${readingExcerpt}

${relationshipContext ? `\n**Relationship Context:** This is about ${personName}'s relationships and love life. Focus on connection, intimacy, heartbreak, and partnership struggles.\n` : ''}

**STEP 1: ANALYZE THE EMOTIONAL ESSENCE**
After reading the excerpt, decide:
- What is the PRIMARY emotion? (sad, chaotic, triumphant, melancholic, hopeful, angry, peaceful)
- Should this be sung by a MAN, WOMAN, or CHOIR?
- What 70s/80s artist style fits best?
  Options: Carole King (70s piano), Paul Simon (70s folk), Celine Dion (80s power ballad), 
  Bruce Springsteen (80s rock), ABBA (70s disco/pop), Aretha Franklin (70s soul),
  Fleetwood Mac (70s rock), Billy Joel (70s/80s piano), Joni Mitchell (70s folk),
  Phil Collins (80s emotional), Whitney Houston (80s R&B), Elton John (70s/80s piano)

**STEP 2: WRITE THE LYRICS**
Structure (DO NOT label sections in the actual lyrics):
- Verse 1 (4 lines)
- Chorus (4 lines)
- Verse 2 (4 lines)
- Chorus (4 lines)
- Bridge (3-4 lines)
- Final Chorus (4 lines)

CRITICAL FORMAT RULE:
- ❌ Do NOT write labels like "Verse", "Chorus", "Bridge", "Intro", "Outro" anywhere in the lyrics.
- ✅ Use blank lines to separate sections instead.

Style Guide:
- Conversational but poetic (Paul Simon)
- Big emotions, universal themes (Celine Dion)
- Specific details that feel real and relatable
- NO clichés, NO astrology jargon
- Make people FEEL something deep

**OUTPUT FORMAT (JSON ONLY):**
{
  "lyrics": "Line 1\\nLine 2\\nLine 3\\nLine 4\\n\\nLine 1\\nLine 2\\nLine 3\\nLine 4\\n\\n...",
  "title": "Song Title (2-4 words)",
  "musicStyle": "70s piano ballad" or "80s power rock" etc,
  "vocalist": "Female (Carole King style)" or "Male choir (Aretha Franklin style)" etc,
  "emotion": "melancholic" or "triumphant" or "chaotic" etc,
  "minimaxPrompt": "A heartbreaking 70s piano ballad sung by a female vocalist with the emotional depth and vulnerability of Carole King. Sparse piano with subtle strings. Intimate, tender vocal delivery that builds to emotional climax in the chorus."
}

The minimaxPrompt should be 1-2 sentences describing the exact musical execution for MiniMax (artist style, instrumentation, vocal approach, emotional tone). Be specific about 70s/80s era and artist influences.

Generate the complete song now:`;

  try {
    const response = await llm.generate(prompt, 'lyrics-generation', {
      maxTokens: 2000, // Increased for JSON + detailed prompt
      temperature: 0.85, // Creative for music style decision
    });

    if (!response) {
      throw new Error('No lyrics generated');
    }

    console.log('🎵 LLM Response (first 300 chars):', response.substring(0, 300));

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in LLM response');
      throw new Error('LLM did not return valid JSON');
    }

    const result = JSON.parse(jsonMatch[0]);

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

