# Western Astrology — Music Prompt

Write a personalized rock opera song for **{personName}** based on their reading.

**Sound**: Phantom of the Opera. Rock opera. Grand, theatrical, emotionally operatic. A man and a woman singing as a duet — the two voices in tension, in longing, in confrontation.

**Vocalist**: Male and female duet. Both voices strong. The man darker and driven. The woman luminous and devastating.

**Extract from the reading**:
- What does {personName} struggle with emotionally?
- What pattern destroys them in love?
- What do they hide? What do they want?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines, optional)
- [Verse] (4 lines, male or female or alternating)
- [Chorus] (4 lines, both together)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines, dramatic duet)
- [Chorus] (4 lines)
- [Outro] (2 lines, optional)

Rules:
- {personName}'s name must appear at least once in the lyrics
- Theatrical, operatic, not pop
- Grand emotional scale — love, obsession, fate

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (2-4 words)",
  "musicStyle": "rock opera duet",
  "vocalist": "Male and female duet (Phantom of the Opera style)",
  "emotion": "...",
  "minimaxPrompt": "Rock opera in the style of Phantom of the Opera. Male and female voices — the man dark and haunted, the woman luminous and powerful. Grand orchestral arrangement: pipe organ, strings, electric guitar underneath. Theatrical, operatic, emotionally overwhelming. Duet dynamic — longing, tension, confrontation. Never pop."
}
```
