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
  
  const prompt = `You are a masterful songwriter in the quiet, poetic tradition of Leonard Cohen, Tom Waits, Bob Dylan, and John Prine. You write INTROSPECTIVE SONGS that capture human struggle, chaos, and transformation - music to listen to while reading, not pop music.

Generate a personalized song for ${personName} based on their life story extracted from this reading. This must be QUIET, POETIC MUSIC - never nervous or pop-oriented.

**CRITICAL RULES:**
1. ❌ NO POP MUSIC - Never nervous, upbeat, or radio-pop style
2. ✅ EXTRACT: Character problems, emotional chaos, life struggles, relationship patterns, fears, desires
3. ✅ MAKE IT EXPLICIT and DRAMATIC - about their LIFE and EMOTIONS
4. ✅ The person's name (${personName}) must appear naturally in lyrics (at least once)
5. ✅ QUIET, POETIC STYLE - Always in the tradition of Leonard Cohen, Tom Waits, Bob Dylan, John Prine
6. ✅ MUSIC TO LISTEN TO - Introspective, contemplative, poetry set to music
7. ✅ Think: "Hallelujah", "Closing Time", "Like a Rolling Stone", "Angel from Montgomery"

The reading below is JUST RAW MATERIAL to extract ${personName}'s story:
- What does ${personName} struggle with emotionally?
- What chaos do they live through?
- What relationship patterns destroy them?
- What do they fear most?
- What do they hide from others?
- What makes them feel alive or dead inside?

**Reading Excerpt (Use as research material):**
${readingExcerpt}

${relationshipContext ? `\n**Relationship Context:** This is about ${personName}'s relationships and love life. Focus on connection, intimacy, heartbreak, and partnership struggles.\n` : ''}

**STEP 1: PSYCHOLOGICAL EVALUATION & MOOD ANALYSIS**
After reading the excerpt, perform a psychological evaluation:
- What is the PRIMARY emotion? (sad, happy, dark, chaotic, triumphant, melancholic, hopeful, angry, peaceful)
- Should this be sung by a MAN, WOMAN, or CHOIR?
- Should this be a SOLO, DUET, or CHOIR performance? (Based on reading content or random selection)

**STEP 2: SELECT 70s/80s ARTIST STYLE (Randomly from 50 options)**
Randomly select ONE artist from this pool of 50 iconic 70s/80s musicians:
The Who, Rolling Stones, David Bowie, Carole King, Paul Simon, Celine Dion, Bruce Springsteen, ABBA, Aretha Franklin, Fleetwood Mac, Billy Joel, Joni Mitchell, Phil Collins, Whitney Houston, Elton John, Led Zeppelin, Pink Floyd, Queen, The Beatles, The Doors, Stevie Wonder, Marvin Gaye, Donna Summer, Bee Gees, Earth Wind & Fire, Chic, Blondie, Talking Heads, The Clash, The Police, U2, Dire Straits, Genesis, Yes, Rush, Journey, Foreigner, Boston, Kansas, Styx, REO Speedwagon, Heart, Pat Benatar, Cyndi Lauper, Madonna, Prince, Michael Jackson, Tina Turner, Eurythmics, Duran Duran

**CRITICAL**: Even if you select a high-energy artist (like The Who or Rolling Stones), the FINAL EXECUTION must be QUIET and POETIC in the style of Leonard Cohen, Tom Waits, Bob Dylan, or John Prine. This is music to listen to while reading text - never nervous or pop-oriented. The selected artist is just for subtle musical influence, but the delivery must always be introspective and contemplative.

**STEP 3: EXTRACT & WRITE THE LYRICS**
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
- Quiet, introspective, poetic (Leonard Cohen, Tom Waits, Bob Dylan, John Prine)
- Contemplative, not nervous or pop-oriented
- Music to listen to while reading - background, not foreground
- Specific details that feel real and relatable
- NO clichés, NO pop hooks
- Make people FEEL something deep through poetry, not through catchy melodies

**OUTPUT FORMAT (JSON ONLY):**
{
  "lyrics": "Line 1\\nLine 2\\nLine 3\\nLine 4\\n\\nLine 1\\nLine 2\\nLine 3\\nLine 4\\n\\n...",
  "title": "Song Title (2-4 words)",
  "musicStyle": "70s piano ballad" or "80s power rock" etc,
  "vocalist": "Female (Carole King style)" or "Male choir (Aretha Franklin style)" etc,
  "emotion": "melancholic" or "triumphant" or "chaotic" etc,
  "minimaxPrompt": "A quiet, introspective song in the poetic style of Leonard Cohen or Tom Waits. Sparse instrumentation - acoustic guitar or minimal piano. Contemplative, low-key vocal delivery. Music to listen to while reading - never nervous or pop-oriented. Subtle influence from [selected artist] but always executed as quiet, poetic background music."
}

The minimaxPrompt must ALWAYS emphasize:
- QUIET, INTROSPECTIVE style (Leonard Cohen, Tom Waits, Bob Dylan, John Prine)
- Sparse instrumentation (acoustic guitar, minimal piano)
- Contemplative, low-key vocals
- Music to listen to while reading - background, not foreground
- Never nervous, pop, or high-energy
- Even if the selected artist is high-energy, execute it quietly and poetically

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

