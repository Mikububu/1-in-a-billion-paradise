# VEDIC MATCHMAKING AUDIO NARRATION SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Jyotish Matchmaking  
**SCOPE:** Audio narration only  
**INPUT SOURCE:** Structured validated text blocks  
**OUTPUT FORMAT:** Single continuous audiobook  
**TARGET USE:** Long-form listening  
**VOICE:** Neutral human  
**LANGUAGE:** English  
**NUMERAL SYSTEM:** Western  

---

## GLOBAL NARRATION RULES

1. Audio must follow document order exactly
2. No sentence may be reordered
3. No text may be summarized
4. No explanatory additions allowed
5. No metaphors allowed
6. No spiritual or poetic amplification
7. No background music
8. No sound effects
9. No pauses longer than defined below
10. No emphasis beyond punctuation

---

## VOICE CHARACTERISTICS

- **Voice gender:** Neutral
- **Tone:** Calm, factual, grounded
- **Emotional range:** Low variance
- **Speed:** Consistent medium-slow
- **Pitch:** Stable
- **Accent:** Neutral international English

---

## PACING AND RHYTHM

**Average speech rate:**  
140-155 words per minute

**Sentence pause:**  
0.4 seconds

**Paragraph pause:**  
0.8 seconds

**Section pause:**  
1.4 seconds

**No dramatic pauses**  
**No rhetorical pauses**

---

## PRONUNCIATION RULES

- Sanskrit terms pronounced clearly and slowly
- Nakshatra names spelled phonetically
- Planet names pronounced in Western English
- Numbers read as numerals, not words, when part of scores

**Example:**  
Say "twenty-five out of thirty-six"  
Not "twenty-five slash thirty-six"

---

## SCORE READING RULES

All scores must be spoken explicitly.

**Example:**  
"Gana score: four out of six"

Never say "good", "bad", "strong", "weak" unless explicitly present in text.

---

## SECTION-BY-SECTION NARRATION BEHAVIOR

### Cover Section

- Read title once
- Pause 1.4 seconds
- Read names
- Pause 1.4 seconds

---

### Introduction Section

- Neutral explanatory tone
- No emphasis
- No conclusion cues

---

### Birth Data Section

- Read each individual separately
- Pause 0.8 seconds between individuals

---

### Nakshatra Attributes Section

- Read attributes as list items
- Pause 0.4 seconds between attributes

---

### Ashtakoota Section

- Read each koota in order
- Always read score then interpretation
- Pause 0.8 seconds between kootas

---

### Yoni Section

- Maintain factual tone
- No sensual emphasis
- No vocal stress

---

### Gana Section

- Maintain analytical tone
- Avoid judgmental inflection

---

### Dosha Section

- Dosha presence read first
- Cancellation read second
- Severity read last
- Pause 1 second between doshas

---

### Timing Section

- Read dashas slowly
- Pause 0.5 seconds between periods

---

### Conclusion Section

- Neutral summarizing tone
- No motivational or advisory emphasis

---

### Remedies Section

- Only read if present
- Tone: instructional
- No promise language

---

## TECHNICAL CHUNKING RULES

- Maximum chunk size: 300 characters
- Chunk boundaries must align with sentence boundaries
- No chunk may end mid-sentence
- Chunks must be generated sequentially
- No parallel generation allowed

---

## AUDIO STITCHING RULES

- No crossfades
- No overlap
- No silence insertion
- Exact waveform concatenation

---

## ERROR HANDLING

**If a chunk fails:**  
- Retry sequentially
- Do not skip
- Do not reorder

**If entire audio fails:**  
- Return explicit failure state
- Do not return partial audio

---

## OUTPUT VALIDATION

- Total audio duration must match text length within 10%
- No missing sections
- No duplicated sections

---

**END OF DOCUMENT**
