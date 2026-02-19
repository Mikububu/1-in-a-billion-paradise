# Kabbalah — Music Prompt

Write a personalized Hebrew spiritual song for **{personName}** based on their reading.

**Sound**: Slow, melancholic Jewish music. A man and a woman singing — sometimes together, sometimes answering each other. Violin. The feeling of midnight prayer.

**Vocalist**: Duet — woman and man. The woman's voice: clear, luminous, longing. The man's voice: deep, grounded, sorrowful. Both singing primarily in Hebrew.

**Extract from the reading**:
- What is {personName}'s deepest longing?
- What has been broken and not yet repaired?
- What does the soul know that the person cannot admit?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines, optional — can be Hebrew invocation)
- [Verse] (4 lines — woman, man, or together)
- [Chorus] (4 lines — both voices in harmony)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines — duet, call and response)
- [Chorus] (4 lines)
- [Outro] (2 lines, optional)

Rules:
- {personName}'s name must appear at least once (Hebrew transliteration is fine)
- Primarily in Hebrew — use transliteration so MiniMax can render it
- Melancholic, never celebratory

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (Hebrew or English, 2-4 words)",
  "musicStyle": "slow melancholic Jewish music",
  "vocalist": "Duet — woman and man (Hebrew)",
  "emotion": "...",
  "minimaxPrompt": "Slow, melancholic Jewish music. Male and female duet — the woman's voice clear and luminous, the man's voice deep and sorrowful. Primarily in Hebrew. Violin, oud or acoustic guitar, minimal percussion. Very slow tempo. The feeling of midnight prayer. Mystical, intimate, spiritually deep. Music to listen to while reading — never pop or commercial."
}
```
