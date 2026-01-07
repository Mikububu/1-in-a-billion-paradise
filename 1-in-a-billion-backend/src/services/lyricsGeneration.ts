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
  title?: string;
  style?: string;
}

/**
 * Generate personalized song lyrics from reading data
 */
export async function generateLyrics(input: LyricsGenerationInput): Promise<LyricsResult> {
  const { personName, readingText, relationshipContext, systemContext } = input;

  // Extract key themes from reading (first 5000 chars to avoid token limits)
  const readingExcerpt = readingText.substring(0, 5000);
  
  const prompt = `You are a masterful songwriter specializing in dark, poetic, intimate songs. Your style blends 70% Leonard Cohen, 20% Paul Simon, and 10% Tom Waits—deep, minimal, emotionally raw, and beautifully haunting.

Generate a personalized song for ${personName} based on their soul reading. The song must:

1. **Explicitly include their name** in the lyrics (at least once, naturally woven in)
2. Reflect their core soul themes, emotional patterns, fears, desires, and life direction
3. Be dark, poetic, and intimate—NOT pop or commercial
4. Be approximately 3 minutes when sung (roughly 12-16 lines of verse/chorus)
5. Use minimal instrumentation imagery (piano, guitar, sparse arrangements)
6. Feel like a personal meditation on their soul's journey

${systemContext ? `\nThis song is specifically about their ${systemContext} insights. Focus on themes relevant to this system.\n` : ''}
${relationshipContext ? `\nAdditional context: This is a relationship reading. Incorporate themes of connection, synastry, and partnership dynamics.\n` : ''}

**Reading Excerpt:**
${readingExcerpt}

**Instructions:**
- Write complete lyrics (verse, chorus, verse, chorus, bridge, final chorus)
- Use poetic, metaphorical language
- Reference specific themes from the reading (fears, desires, life direction)
- Make it deeply personal and emotionally resonant
- Keep it dark and beautiful, not uplifting or commercial

**Output Format:**
Return ONLY the lyrics, line by line, with clear verse/chorus markers. Do not include explanations or metadata.

Example structure:
[Verse 1]
Line 1...
Line 2...

[Chorus]
Line 1...
Line 2...

[Verse 2]
...

Generate the complete song lyrics now:`;

  try {
    const response = await llm.generate(prompt, 'lyrics-generation', {
      maxTokens: 1500,
      temperature: 0.8, // Creative but focused
    });

    if (!response) {
      throw new Error('No lyrics generated');
    }

    // Extract lyrics (remove any markdown formatting)
    let lyrics = response.trim();
    
    // Remove markdown code blocks if present
    lyrics = lyrics.replace(/```[\s\S]*?```/g, '');
    lyrics = lyrics.replace(/^#+\s*/gm, '');
    
    // Clean up
    lyrics = lyrics.trim();

    // Extract title if present (first line in quotes or after "Title:")
    let title: string | undefined;
    const titleMatch = lyrics.match(/(?:Title|Song):\s*["']?([^"'\n]+)["']?/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      lyrics = lyrics.replace(/^(?:Title|Song):\s*["']?[^"'\n]+["']?\s*\n?/i, '');
    }

    return {
      lyrics,
      title,
      style: 'dark_poetic_intimate',
    };
  } catch (error: any) {
    console.error('❌ Lyrics generation failed:', error);
    throw new Error(`Failed to generate lyrics: ${error.message}`);
  }
}

