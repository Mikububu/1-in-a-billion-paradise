# Gene Keys — Music Prompt

Write a personalized atonal opera song for **{personName}** based on their reading.

**Sound**: Karlheinz Stockhausen. Atonal, abstract, avant-garde classical. Not music you hum — music that reorganizes how you hear. The feeling of consciousness itself being examined under a microscope.

**Vocalist**: Female. Abstract operatic — not melodic, not pop. A voice that moves through space rather than through song. Unsettling and beautiful simultaneously.

**Extract from the reading**:
- What shadow has {personName} been living inside?
- What is the gift trying to emerge through the distortion?
- What would it sound like if the shadow finally spoke?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines, optional — can be fragmented, abstract)
- [Verse] (4 lines)
- [Chorus] (4 lines — can be a repeated tonal phrase, not necessarily rhyming)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines — the most abstract section, the shadow speaking)
- [Chorus] (4 lines)
- [Outro] (2 lines, optional)

Rules:
- {personName}'s name must appear at least once
- Abstract and fragmented language is welcome — this is not pop storytelling
- The lyrics should feel like they are coming from somewhere underneath normal thought

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (2-4 words)",
  "musicStyle": "atonal avant-garde opera",
  "vocalist": "Female (abstract operatic — Stockhausen tradition)",
  "emotion": "...",
  "minimaxPrompt": "Atonal avant-garde composition in the style of Karlheinz Stockhausen. Female abstract opera vocalist — not melodic, not pop, moving through dissonance and space. Experimental electronic textures, prepared piano, sparse atonal strings. Unsettling and beautiful. The feeling of hearing something that was always there but never audible. Never commercial, never pop."
}
```
