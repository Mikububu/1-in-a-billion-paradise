# Vedic Astrology — Music Prompt

Write a personalized Indian classical song for **{personName}** based on their reading.

**Sound**: Anoushka Shankar on sitar. Hariprasad Chaurasia on bansuri flute. Kali mantra chanting underneath. Meditative, spiritual, emotionally deep. Music that sounds like fate being accepted.

**Vocalist**: Female. Devotional, clear, unhurried. Can include Sanskrit or Hindi phrases woven into English.

**Extract from the reading**:
- What is {personName}'s deepest emotional struggle?
- What karmic pattern shapes their life?
- What do they fear? What do they long for?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines, optional — can be Sanskrit invocation)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines — can be mantra or chant)
- [Chorus] (4 lines)
- [Outro] (2 lines, optional)

Rules:
- {personName}'s name must appear at least once
- Meditative, not pop
- Optional Sanskrit/Hindi phrases welcome — they deepen the atmosphere

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (2-4 words)",
  "musicStyle": "Indian classical meditation",
  "vocalist": "Female (devotional, Anoushka Shankar tradition)",
  "emotion": "...",
  "minimaxPrompt": "Indian classical meditation. Anoushka Shankar sitar, Hariprasad Chaurasia bansuri flute, tabla, tanpura drone. West Bengal Kali mantra chanting woven underneath. Female vocalist — devotional, clear, unhurried. Slow tempo. Spiritual and emotionally deep. Music to listen to while reading — never pop or commercial."
}
```
