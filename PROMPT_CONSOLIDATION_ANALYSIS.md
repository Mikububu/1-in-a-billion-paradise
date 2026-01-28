# PROMPT CONSOLIDATION ANALYSIS
## Complete Mapping of TypeScript Prompts → MD File

**Goal**: Move ALL prompt content from scattered TypeScript files into `deep-reading-prompt.md`, leaving only data assembly logic in TypeScript.

---

## CURRENT STATE: TypeScript Files

### 📁 `src/prompts/` (31 TypeScript files)

#### **CORE** (6 files)
1. ✅ `core/storytelling-voice.ts` - Opening invocation, storytelling style, shadow voice
2. ✅ `core/forbidden.ts` - Forbidden phrases list
3. ✅ `core/output-rules.ts` - Format rules (audio, 3rd person, no markdown)
4. ✅ `core/psychological-provocations.ts` - Questions to provoke deep thinking
5. ✅ `core/quality-checks.ts` - Quality standards
6. ❓ `core/index.ts` - Exports

#### **STYLES** (3 files)
7. ✅ `styles/spicy-surreal.ts` - Dark soul storytelling style
8. ✅ `styles/production.ts` - Literary documentary style
9. ❓ `styles/index.ts` - Exports

#### **SPICE** (2 files)
10. ✅ `spice/levels.ts` - Spice 1-10 calibration configs
11. ❓ `spice/index.ts` - Exports

#### **SYSTEMS** (6 files)
12. ✅ `systems/western.ts` - Western astrology explanations
13. ✅ `systems/vedic.ts` - Vedic/Jyotish explanations (LEFT-HANDED PATH)
14. ✅ `systems/human-design.ts` - HD explanations
15. ✅ `systems/gene-keys.ts` - Gene Keys explanations
16. ✅ `systems/kabbalah.ts` - Kabbalah explanations
17. ❓ `systems/index.ts` - Exports

#### **STRUCTURES** (5 files)
18. ✅ `structures/individual.ts` - Individual reading structure
19. ✅ `structures/overlay.ts` - Synastry reading structure
20. ✅ `structures/nuclear.ts` - Nuclear 5-part structure
21. ✅ `structures/paidReadingPrompts.ts` - Nuclear V2 prompts (person/overlay/verdict)
22. ❓ `structures/index.ts` - Exports

#### **EXAMPLES** (3 files)
23. ✅ `examples/transformations.ts` - Example transformations
24. ✅ `examples/surreal-metaphors.ts` - Surreal imagery examples
25. ❓ `examples/index.ts` - Exports

#### **TECHNIQUES** (2 files)
26. ✅ `techniques/system-weaving.ts` - How to weave multiple systems
27. ❓ `techniques/index.ts` - Exports

#### **BUILDERS** (4 files)
28. ⚙️ `builder.ts` - **KEEP** (assembles prompts, interpolates data)
29. ⚙️ `nuclearPackagePrompt.ts` - **KEEP** (nuclear package assembly)
30. ⚙️ `nuclearPrompts.ts` - **KEEP** (nuclear prompts assembly)
31. ❓ `index.ts` - **KEEP** (main exports)

---

## WHAT'S ALREADY IN `deep-reading-prompt.md`

### ✅ ALREADY COVERED (V3):
- Part 1: THE THESIS (first 500-800 words, three pillars)
- Part 2: HOW TO BEGIN (invocation, opening line)
- Part 3: WRITING STYLE (dark soul storytelling)
- Part 4: SHADOW AND DEPTH (honesty, tragic realism)
- Part 5: SEX AS DOORWAY OR DESTRUCTION
- Part 6: MATERIAL SHADOW (derived from charts)
- Part 7: SYSTEM EXPLANATIONS (Vedic, Western, HD, GK, Kabbalah)
- Part 8: KARMIC MAGNETISM (irrational pull)
- Part 9: COMPATIBILITY IS RELATIVE TO DESIRE
- Part 10: SOUL ORIENTATION (Dharma/Artha/Kama/Moksha)
- Part 11: TRAGIC REALISM LENS
- Part 12: SPICE LEVEL CALIBRATION
- Part 13: FORBIDDEN PHRASES
- Part 14: OUTPUT FORMAT
- Part 15: OVERLAY READINGS (relational weaving)
- Part 16: QUALITY STANDARD
- Part 17: FINAL CHECKLIST
- Part 18: VOICE LOCK

---

## WHAT'S MISSING FROM MD FILE

### ❌ NOT YET IN MD FILE:

#### 1. **PSYCHOLOGICAL PROVOCATIONS** (`core/psychological-provocations.ts`)
- Questions that force LLM to THINK before writing
- Person provocations (sex, obsession, wound, gift)
- Overlay provocations (attraction, destruction, sex/power)
- Verdict provocations (synthesis, honesty)
- **ACTION**: Add as PART 19

#### 2. **PRODUCTION STYLE** (`styles/production.ts`)
- Literary documentary style (vs. dark soul storytelling)
- **ACTION**: Merge into PART 3 (expand style section)

#### 3. **EXAMPLES** (`examples/transformations.ts`, `examples/surreal-metaphors.ts`)
- Example transformations (clinical → mythic)
- Surreal metaphor examples
- **ACTION**: Add as PART 20 (optional, for reference)

#### 4. **SYSTEM WEAVING** (`techniques/system-weaving.ts`)
- How to weave multiple systems together (nuclear readings)
- **ACTION**: Add as PART 21

#### 5. **STRUCTURE TEMPLATES** (`structures/individual.ts`, `structures/overlay.ts`, `structures/nuclear.ts`)
- Specific section guidance for each reading type
- **ACTION**: Expand PART 15 (overlay) and add individual/nuclear structures

#### 6. **NUCLEAR V2 SPECIFIC** (`structures/paidReadingPrompts.ts`)
- 15-doc structure (5 systems × 3 doc types)
- Verdict doc structure
- **ACTION**: Add as PART 22 (Nuclear Package Structure)

#### 7. **TRAGIC REALISM LEVELS** (from `paidReadingPrompts.ts`)
- Conditional inevitability
- Cost of the gift
- The loop
- **ACTION**: Already in PART 11, but expand with examples

---

## CONSOLIDATION PLAN

### PHASE 1: EXPAND MD FILE ✅ (Add missing content)

**New sections to add:**

```markdown
## PART NINETEEN: PSYCHOLOGICAL PROVOCATIONS
(Move from core/psychological-provocations.ts)
- Person provocations
- Overlay provocations
- Verdict provocations

## PART TWENTY: EXAMPLES (OPTIONAL REFERENCE)
(Move from examples/*.ts)
- Transformation examples
- Surreal metaphor examples

## PART TWENTY-ONE: SYSTEM WEAVING
(Move from techniques/system-weaving.ts)
- How to weave multiple systems in nuclear readings

## PART TWENTY-TWO: READING STRUCTURES
(Move from structures/*.ts)
- Individual structure
- Overlay structure
- Nuclear 5-part structure
- Nuclear V2 15-doc structure

## PART TWENTY-THREE: STYLE VARIATIONS
(Move from styles/*.ts)
- Production style (literary documentary)
- Spicy surreal style (dark soul storytelling)
```

### PHASE 2: SIMPLIFY TYPESCRIPT ⚙️ (Remove content, keep logic)

**Files to DELETE entirely:**
- ❌ `core/storytelling-voice.ts`
- ❌ `core/forbidden.ts`
- ❌ `core/output-rules.ts`
- ❌ `core/psychological-provocations.ts`
- ❌ `core/quality-checks.ts`
- ❌ `styles/spicy-surreal.ts`
- ❌ `styles/production.ts`
- ❌ `spice/levels.ts` (keep only the TYPE definition)
- ❌ `systems/western.ts`
- ❌ `systems/vedic.ts`
- ❌ `systems/human-design.ts`
- ❌ `systems/gene-keys.ts`
- ❌ `systems/kabbalah.ts`
- ❌ `structures/individual.ts`
- ❌ `structures/overlay.ts`
- ❌ `structures/nuclear.ts`
- ❌ `examples/transformations.ts`
- ❌ `examples/surreal-metaphors.ts`
- ❌ `techniques/system-weaving.ts`

**Files to SIMPLIFY (keep only data assembly):**
- ⚙️ `builder.ts` → Only interpolate data, reference MD file
- ⚙️ `structures/paidReadingPrompts.ts` → Only interpolate data
- ⚙️ `nuclearPackagePrompt.ts` → Only interpolate data
- ⚙️ `nuclearPrompts.ts` → Only interpolate data

**New TypeScript structure:**
```typescript
// builder.ts (SIMPLIFIED)
export function buildIndividualPrompt(config: IndividualPromptConfig): string {
  return `
READ AND FOLLOW: deep-reading-prompt.md (COMPLETE MASTER PROMPT)

READING TYPE: Individual
SYSTEM: ${config.system}
SPICE LEVEL: ${config.spiceLevel}/10
STYLE: ${config.style}

PERSON DATA:
Name: ${config.person.name}
Birth: ${config.person.birthDate} at ${config.person.birthTime}
Location: ${config.person.birthPlace}

CHART DATA:
${config.chartData[config.system]}

${config.personalContext ? `PERSONAL CONTEXT: "${config.personalContext}"` : ''}

NOW GENERATE THE READING.
Begin directly with the opening invocation.
  `;
}
```

### PHASE 3: UPDATE WORKERS ⚙️ (Reference MD file)

**Files to update:**
- `src/workers/textWorker.ts` → Add reference to MD file at top of prompts
- `src/routes/jobs.ts` → No changes needed (already passes spiceLevel)

---

## FINAL STRUCTURE

### MD FILE: `deep-reading-prompt.md` (SINGLE SOURCE OF TRUTH)
- All style instructions
- All system explanations
- All spice calibration
- All forbidden phrases
- All output rules
- All structures
- All examples
- All provocations
- **~2000 lines total**

### TYPESCRIPT: Only Data Assembly
- `builder.ts` → Interpolate data, reference MD file
- `structures/paidReadingPrompts.ts` → Interpolate data, reference MD file
- `nuclearPackagePrompt.ts` → Interpolate data, reference MD file
- `nuclearPrompts.ts` → Interpolate data, reference MD file
- **~200 lines total per file**

---

## BENEFITS

1. ✅ **Single source of truth** - All prompt logic in ONE place
2. ✅ **Easy to update** - Change MD file, affects all readings
3. ✅ **Version control** - Track prompt evolution in one file
4. ✅ **Claude can study it** - Complete instructions in one document
5. ✅ **Cleaner codebase** - TypeScript only handles data
6. ✅ **No more scattered logic** - No hunting through 31 files

---

## RISKS & MITIGATION

### Risk 1: MD file too large for LLM context
**Mitigation**: Claude Sonnet 4.5 has 200K context window, our MD file will be ~50K tokens

### Risk 2: Breaking existing functionality
**Mitigation**: Phase approach - expand MD first, test, then remove TS files

### Risk 3: Loss of type safety
**Mitigation**: Keep TypeScript types, only move prompt CONTENT to MD

---

## NEXT STEPS

1. **Review this analysis** - Confirm approach
2. **Expand MD file** - Add Parts 19-23
3. **Test with one reading type** - Verify it works
4. **Simplify TypeScript** - Remove content, keep data assembly
5. **Test all reading types** - Ensure nothing breaks
6. **Delete old files** - Clean up codebase
7. **Commit & deploy** - Single atomic commit

---

**STATUS**: ⏸️ AWAITING USER APPROVAL TO PROCEED
