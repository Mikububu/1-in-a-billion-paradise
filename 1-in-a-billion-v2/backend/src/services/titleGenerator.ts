import { llm } from './llm';

/**
 * Generate dramatic, evocative titles for readings and songs
 * Uses separate LLM call to create compelling titles that capture essence
 */
export async function generateDramaticTitles(params: {
  system: string;
  personName: string;
  textExcerpt: string; // First 500-800 chars of reading
  docType: 'person1' | 'person2' | 'overlay' | 'verdict';
  spiceLevel?: number;
}): Promise<{ readingTitle: string; songTitle: string }> {
  
  const systemNames: Record<string, string> = {
    western: 'Western Astrology',
    vedic: 'Vedic Astrology (Jyotish)',
    human_design: 'Human Design',
    gene_keys: 'Gene Keys',
    kabbalah: 'Kabbalah',
    verdict: 'Final Verdict',
  };

  const systemLabel = systemNames[params.system] || params.system;
  const spiceContext = params.spiceLevel && params.spiceLevel >= 7
    ? 'This reading is intense, dark, and unflinching. Titles should reflect shadow work and raw truth.'
    : params.spiceLevel && params.spiceLevel >= 5
    ? 'This reading balances light and shadow. Titles should be poetic but honest.'
    : 'This reading is balanced and insightful. Titles should be evocative but not overly dark.';

  const prompt = `You are a master of dramatic, evocative titles for astrological readings and songs.

CONTEXT:
- Astrological System: ${systemLabel}
- Person: ${params.personName}
- Reading Type: ${params.docType}
- Intensity: ${spiceContext}
- Reading Excerpt:
"${params.textExcerpt}"

TASK: Create TWO dramatic titles that capture the ESSENCE of this person's soul journey.

READING TITLE (3-5 words MAX):
- Captures the core essence in just a few words
- Evocative, poetic, mysterious
- Makes you WANT to listen/read immediately  
- Examples: "The Warrior's Heart", "Fire Meets Water", "Dancing with Shadows"
- Like a powerful song title or book chapter
- SHORT and PUNCHY - avoid long phrases

SONG TITLE (2-4 words MAX):
- Musical, lyrical, emotional
- Short and memorable like real hit songs
- Could be a song on Spotify
- Examples: "Burning Bright", "Moon Whispers", "Chaos and Grace"
- Should capture pure FEELING
- Think: real song titles, not sentences

RULES:
- Titles must be SPECIFIC to this reading's content (not generic)
- Use metaphor and imagery from the excerpt
- Avoid: "Journey", "Path", "Soul's", "Cosmic" unless truly relevant
- Prefer: Concrete images, emotional states, paradoxes
- NO explanations, ONLY the JSON output

OUTPUT FORMAT (JSON only):
{
  "readingTitle": "...",
  "songTitle": "..."
}`;

  try {
    console.log(`🎭 Generating dramatic titles for ${params.personName}/${params.system}...`);
    
    const response = await llm.generate(prompt, 'title-generation', {
      maxTokens: 200,
      temperature: 0.95, // High creativity
    });
    
    console.log(`📝 LLM response:`, response.substring(0, 300));
    
    // Parse JSON response (extract JSON block if embedded in text)
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error('❌ LLM did not return valid JSON');
      throw new Error('LLM did not return valid JSON');
    }
    
    const titles = JSON.parse(jsonMatch[0]);
    
    // Validate
    if (!titles.readingTitle || !titles.songTitle) {
      console.error('❌ Missing required titles in response:', titles);
      throw new Error('Missing required titles');
    }
    
    // Trim and validate length
    const readingTitle = String(titles.readingTitle).trim();
    const songTitle = String(titles.songTitle).trim();
    
    if (readingTitle.length < 5 || readingTitle.length > 100) {
      console.warn('⚠️ Reading title length unusual:', readingTitle.length);
    }
    
    if (songTitle.length < 3 || songTitle.length > 80) {
      console.warn('⚠️ Song title length unusual:', songTitle.length);
    }
    
    console.log(`✅ Generated dramatic titles:`);
    console.log(`   📖 Reading: "${readingTitle}"`);
    console.log(`   🎵 Song: "${songTitle}"`);
    
    return {
      readingTitle,
      songTitle,
    };
    
  } catch (error: any) {
    console.error('❌ Title generation failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Fallback titles based on system and person
    const fallbackReading = `${params.personName}'s ${systemLabel} Journey`;
    const fallbackSong = `${params.personName}'s Song`;
    
    console.log(`⚠️ Using fallback titles: "${fallbackReading}" / "${fallbackSong}"`);
    
    return {
      readingTitle: fallbackReading,
      songTitle: fallbackSong,
    };
  }
}
