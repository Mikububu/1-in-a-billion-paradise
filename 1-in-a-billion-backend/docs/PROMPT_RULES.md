# HOOK READING PROMPT RULES

## ⚠️ CRITICAL: Swiss Ephemeris Data Flow

**THIS BUG WAS FOUND AND FIXED - ALWAYS CHECK THIS FIRST!**

The Swiss Ephemeris calculates exact planetary positions. If readings show "unknown position", the data flow is broken.

### Required Data Flow:
```
swissEngine.computePlacements() 
    ↓
readings.ts (passes `placements` to generateHookReading)
    ↓
deepseekClient.ts (includes `placements` in PromptContext)
    ↓
prompts.ts (formats as "0 degrees 26 minutes Virgo")
```

### Check on App Start:
1. Backend logs should show: `Swiss Ephemeris: Using ephe path: .../ephe`
2. Test endpoint should return actual degrees, NOT "unknown position"
3. If broken: Check that `placements` is passed through the entire chain above

### Files to Check:
- `src/routes/readings.ts` - Must pass `placements` to `generateHookReading()`
- `src/services/text/deepseekClient.ts` - Must include `placements` in `ctx`
- `src/services/text/prompts.ts` - Uses `ctx.placements?.sunDegree` etc.

---

## Critical Rules for AI Readings

### 1. Birthday Format
- **Format**: `23rd August 1968` (ordinal day + month + year)
- **NOT**: `August 23, 1968` or `23/08/1968`
- This reads naturally when spoken aloud by TTS

### 2. Birthday Placement
- **SUN page**: Include full birth details (date + time)
- **MOON page**: Do NOT repeat birthday
- **RISING page**: Do NOT repeat birthday

### 3. Moon & Rising Explanations
Instead of repeating the birthday on Moon and Rising pages, explain what these placements MEAN:

**Moon Sign** (what to explain):
> "Your Moon sign reveals your emotional interior, how you need to be loved when no one else is watching, and the childhood wounds that still shape your attachments."

**Rising Sign** (what to explain):
> "Your Rising sign is the mask you wear before trust is earned, the first impression you make, and the armor you built to protect the softer self within."

### 4. Exact Degree Position & Poetic Descriptions
- Always mention the exact degree from Swiss Ephemeris
- Example: "at 15 degrees Virgo" NOT "15° Virgo"
- Write out numbers for TTS compatibility

**Degree Range Descriptions (NEVER use the word "decan"):**
- **0-10 degrees (Early)**: "where the sign is still forming itself, at its very point of origin"
- **10-20 degrees (Middle)**: "where the sign reaches its fullest expression"
- **20-30 degrees (Late)**: "where the sign prepares to transition, at its completion"

**Example output:**
> "Your core identity, the Sun at 0 degrees 26 minutes Virgo, born on 23 August 1968. Your Virgo energy emerges at its very point of origin, where the sign is still forming itself. You are not just..."

**What NOT to say:**
> ❌ "This is the earliest degree, the 1st decan."
> ❌ "You are in the first decan of Virgo."
> ❌ "The decan suggests..."

Use natural, poetic language that flows seamlessly into the reading.

### 5. Word Limits (STRICT)
- **Preamble**: 30-40 words MAX
- **Analysis**: 70-80 words MAX
- **Total**: 100-120 words ABSOLUTE MAX
- Must fit one phone screen without scrolling

### 6. 1st Person vs 3rd Person

**1st Person (User's own reading):**
- Use "you/your"
- Start with greeting: "Dear child of the sun...", "Beloved soul..."
- Include birthday on SUN page

**3rd Person (Partner reading):**
- NEVER use "you/your" or pronouns (he/she/they)
- ALWAYS use the person's NAME: "Michael's heart", "Michael loves"
- Start directly with name: "Michael, born Leo on 23rd August 1968..."
- Include birthday on SUN page only

### 7. TTS Compatibility
- No symbols: °, ', ♈, ♉, etc.
- No em dashes (—) or en dashes (–)
- Write numbers as words when possible
- Use commas or hyphens only

---

*These rules are implemented in `/src/services/text/prompts.ts`*

