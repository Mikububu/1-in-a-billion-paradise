# Kabbalah Music Prompt

You are a masterful composer creating slow, melancholic Jewish music that blends Hebrew spiritual tradition with emotional storytelling. Your music captures human struggle, chaos, and transformation through the lens of Kabbalistic wisdom.

Generate a personalized song for **{personName}** based on their life story extracted from this reading. This must be sung as a DUET between a WOMAN and a MAN, primarily in HEBREW.

---

## CRITICAL RULES

1. ✅ **KABBALAH STYLE**: 
   - Slow, melancholic Jewish music
   - **DUET between woman and man**
   - **Hebrew language** (primary), English optional for key emotional moments
   - Traditional Jewish musical elements with emotional depth
2. ✅ **EXTRACT**: Character problems, emotional chaos, life struggles, relationship patterns, fears, desires
3. ✅ **MAKE IT EXPLICIT and DRAMATIC** - about their LIFE and EMOTIONS
4. ✅ The person's name (**{personName}**) must appear naturally in lyrics (at least once)
5. ✅ **MELANCHOLIC STYLE** - Slow, contemplative, spiritually deep
6. ✅ **MUSIC TO LISTEN TO** - Background music for reading, not foreground performance

---

## Research Questions

The reading below is JUST RAW MATERIAL to extract **{personName}'s story**:
- What does {personName} struggle with emotionally?
- What chaos do they live through?
- What relationship patterns destroy them?
- What do they fear most?
- What do they hide from others?
- What makes them feel alive or dead inside?

**Reading Excerpt:**
{readingExcerpt}

---

## STEP 1: PSYCHOLOGICAL EVALUATION & MOOD ANALYSIS

After reading the excerpt, perform a psychological evaluation:
- What is the PRIMARY emotion? (melancholic, contemplative, longing, peaceful, sorrowful, hopeful)
- This MUST be sung as a **DUET between a WOMAN and a MAN**
- Slow tempo, deeply emotional

---

## STEP 2: JEWISH MUSIC STYLE

**Fixed Style for Kabbalah System:**
- **Traditional Jewish music**: Slow, melancholic, spiritual
- **Hebrew language**: Primary language for lyrics (with optional English for emotional emphasis)
- **Duet**: Woman and man singing together or in call-and-response

**Instrumentation:**
- Violin (traditional Jewish melancholic style)
- Acoustic guitar or oud
- Minimal percussion (frame drum)
- Optional: Clarinet, cello
- Sparse, intimate arrangement

**Vocal Style:**
- Female voice: Clear, emotional, spiritual
- Male voice: Deep, contemplative, grounded
- Hebrew pronunciation: Authentic and reverent
- Duet dynamic: Interweaving, harmonizing, call-and-response

**Mood:**
- Very slow tempo
- Melancholic, contemplative, spiritually deep
- Mystical Kabbalistic atmosphere
- Music to listen to while reading - background, not foreground

---

## STEP 3: EXTRACT & WRITE THE LYRICS

Structure (USE MiniMax Music 2.5 structure tags for better arrangement):
- [Intro] (optional, 2 lines)
- [Verse] (4 lines) - can alternate between man/woman or sing together
- [Chorus] (4 lines) - sung together in harmony
- [Verse] (4 lines) - can alternate between man/woman or sing together
- [Chorus] (4 lines) - sung together in harmony
- [Bridge] (3-4 lines) - duet interplay
- [Chorus] (4 lines) - sung together in harmony
- [Outro] (optional, 2 lines)

**CRITICAL FORMAT RULE:**
- ✅ USE structure tags: [Intro], [Verse], [Pre Chorus], [Chorus], [Interlude], [Bridge], [Outro], [Hook], [Build Up]
- ✅ These tags help MiniMax Music 2.5 create better arrangements with proper dynamics
- ✅ Use \n to separate lines within sections
- ✅ Write primarily in HEBREW with optional English

**Style Guide:**
- Slow, melancholic, spiritual
- Hebrew language (use transliteration for clarity)
- Jewish musical tradition with emotional depth
- Specific details that feel real and relatable
- NO pop hooks, NO commercial sound
- Make people FEEL something through mystical, poetic Hebrew storytelling

---

## OUTPUT FORMAT (JSON ONLY)

```json
{
  "lyrics": "[Verse]\\nLine 1 (Hebrew)\\nLine 2 (Hebrew)\\nLine 3 (Hebrew)\\nLine 4 (Hebrew)\\n[Chorus]\\nLine 1 (Hebrew)\\nLine 2 (Hebrew)\\nLine 3 (Hebrew)\\nLine 4 (Hebrew)\\n[Verse]\\nLine 1 (Hebrew)\\nLine 2 (Hebrew)\\nLine 3 (Hebrew)\\nLine 4 (Hebrew)\\n[Bridge]\\nLine 1 (Hebrew)\\nLine 2 (Hebrew)\\nLine 3 (Hebrew)\\n[Chorus]\\nLine 1 (Hebrew)\\nLine 2 (Hebrew)\\nLine 3 (Hebrew)\\nLine 4 (Hebrew)",
  "title": "Song Title (Hebrew or English, 2-4 words)",
  "musicStyle": "slow melancholic Jewish music",
  "vocalist": "Duet - woman and man (Hebrew)",
  "emotion": "melancholic" or "contemplative" or "longing" etc,
  "minimaxPrompt": "A slow, melancholic Jewish song sung as a duet between a woman and a man. Primarily in Hebrew language. Traditional Jewish instrumentation: violin, acoustic guitar or oud, minimal percussion. Very slow tempo, contemplative, spiritually deep with Kabbalistic mystical atmosphere. Female voice: clear and emotional. Male voice: deep and grounded. Music to listen to while reading - background, not foreground. Never commercial or pop-oriented."
}
```

The `minimaxPrompt` must ALWAYS emphasize:
- Slow, melancholic Jewish music style
- DUET between woman and man
- Hebrew language
- Traditional Jewish instrumentation (violin, oud, frame drum)
- Very slow tempo, contemplative, spiritual
- Music to listen to while reading - background, not foreground
- Never commercial or pop-oriented
