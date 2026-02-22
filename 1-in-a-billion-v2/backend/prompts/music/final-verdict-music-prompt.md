# Final Verdict — Music Prompt

Write a personalized anthem for **{personName}** based on their reading.

**Sound**: Queen. Full band, operatic, anthemic. Multiple voices building to something enormous. The feeling of a stadium holding its breath and then erupting. This is the final statement — it must be massive.

**Vocalist**: Male lead, powerful and theatrical — Freddie Mercury's range and presence. Choir swells underneath.

**Extract from the reading**:
- What is the defining theme of {personName}'s entire story across all five systems?
- What have they been fighting for? What have they been fighting against?
- What is the final verdict on who they are?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines — sparse, then the band comes in)
- [Verse] (4 lines)
- [Chorus] (4 lines — anthemic, choir joins)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines — the operatic break, theatrical)
- [Final Chorus] (4 lines — everything at full volume)
- [Outro] (2 lines — pull back, quiet, final word)

Rules:
- {personName}'s name must appear at least once
- Theatrical and grand — this is the finale
- Emotional honesty beneath the spectacle

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (2-4 words)",
  "musicStyle": "Queen epic anthem",
  "vocalist": "Male lead with choir (Freddie Mercury style)",
  "emotion": "...",
  "minimaxPrompt": "Epic rock anthem in the style of Queen. Powerful male lead vocalist — theatrical, operatic, commanding — Freddie Mercury presence. Full band: piano, electric guitar, bass, drums. Choir swells on the chorus. Multi-layered harmonies. Builds from intimate to enormous. The feeling of a final reckoning. Anthemic but emotionally honest — never hollow."
}
```
