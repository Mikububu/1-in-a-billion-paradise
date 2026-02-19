# Human Design — Music Prompt

Write a personalized ambient song for **{personName}** based on their reading.

**Sound**: Brian Eno's atmospheric textures meeting Paul Simon's intimate acoustic storytelling. Ambient layers underneath. A clear, quiet human voice above. The machine and the human, coexisting.

**Vocalist**: Male. Conversational, warm, unhurried — Paul Simon's intimacy, not operatic grandeur.

**Extract from the reading**:
- What is {personName}'s core conditioning pattern?
- What does the body know that the mind keeps overriding?
- What would it sound like if they finally stopped?

**Reading Excerpt:**
{readingExcerpt}

---

## LYRICS

Structure:
- [Intro] (2 lines, optional — can be ambient texture description)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Verse] (4 lines)
- [Chorus] (4 lines)
- [Bridge] (3-4 lines)
- [Chorus] (4 lines)
- [Outro] (2 lines, optional)

Rules:
- {personName}'s name must appear at least once
- Quiet, specific, grounded — not abstract
- Ambient but human

---

## OUTPUT (JSON only)

```json
{
  "lyrics": "...",
  "title": "Song title (2-4 words)",
  "musicStyle": "ambient acoustic",
  "vocalist": "Male (Paul Simon intimate style)",
  "emotion": "...",
  "minimaxPrompt": "Ambient acoustic song. Brian Eno atmospheric synthesizer pads and slow electronic textures underneath. Paul Simon acoustic guitar and intimate male vocal on top — conversational, warm, unhurried. Sparse arrangement. Meditative. The feeling of a man quietly understanding something about himself. Music to listen to while reading — never pop or commercial."
}
```
