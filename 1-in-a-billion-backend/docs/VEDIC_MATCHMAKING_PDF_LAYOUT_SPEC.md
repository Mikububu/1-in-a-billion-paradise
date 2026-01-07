# VEDIC MATCHMAKING PDF LAYOUT SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Vedic Jyotish Matchmaking  
**INPUT CONTRACT:** Vedic_Matchmaking_LLM_Input_Schema  
**OUTPUT TYPE:** Paginated PDF  
**PAGE SIZE:** A4  
**LANGUAGE:** English  
**NUMERAL SYSTEM:** Western  
**ASTROLOGY SYSTEM:** Jyotish only  

---

## GLOBAL RULES

1. All content must be rendered strictly from validated JSON input.
2. No computed astrology is allowed at PDF stage.
3. No section may be omitted if data exists.
4. Scores must always be shown as `score/max_score`.
5. Doshas must be shown even if cancelled.
6. Interpretive text must be clearly separated from factual tables.
7. No emojis. No metaphors. No mystical exaggeration.
8. Remedy sections only appear if `allow_remedies` is true.

---

## COVER PAGE

### Title
Vedic Compatibility Analysis Report

### Subtitle
Ashtakoota and Jyotish Partnership Evaluation

### Individuals
- Individual A name
- Individual B name

### Metadata
- Report generation timestamp
- System version
- Astrology system: Jyotish

---

## SECTION 1: INTRODUCTION

### Purpose
This report evaluates compatibility using classical Jyotish methods including Ashtakoota Guna Milan, dosha analysis, chart factors, and timing considerations.

### Methodology
- Nakshatra-based lunar comparison
- Point-based compatibility scoring
- Dosha identification and cancellation logic
- Chart-level contextual review

---

## SECTION 2: BIRTH DATA SUMMARY

### Individual A
- Name
- Date of birth
- Time of birth
- Location

### Individual B
- Name
- Date of birth
- Time of birth
- Location

---

## SECTION 3: NAKSHATRA ATTRIBUTES

### Individual A
- Nakshatra
- Pada
- Yoni
- Gana
- Nadi
- Varna
- Vashya

### Individual B
- Nakshatra
- Pada
- Yoni
- Gana
- Nadi
- Varna
- Vashya

---

## SECTION 4: ASHTAKOOTA GUNA MILAN

### Overview Table

| Koota | Score | Max | Status |
|-------|-------|-----|--------|
| Varna | score | 1 | pass/fail |
| Vashya | score | 2 | pass/fail |
| Tara | score | 3 | pass/fail |
| Yoni | score | 4 | friendly/neutral/enemy |
| Graha Maitri | score | 5 | pass/fail |
| Gana | score | 6 | compatible/incompatible |
| Bhakoot | score | 7 | dosha present/absent |
| Nadi | score | 8 | dosha present/absent |

### Total Score
**Total:** obtained/36

### Score Interpretation Bands
- **Below 18:** Not recommended
- **18-24:** Average compatibility
- **25-32:** Strong compatibility
- **33-36:** Exceptional compatibility

---

## SECTION 5: YONI ANALYSIS

### Individual A Yoni
- Animal symbol
- Instinctual traits

### Individual B Yoni
- Animal symbol
- Instinctual traits

### Yoni Relationship
- Relationship type: friendly/neutral/enemy

### Interpretation
- Physical compatibility
- Instinctual harmony or conflict
- Sexual rhythm alignment

---

## SECTION 6: GANA ANALYSIS

### Individual A Gana
Deva/Manushya/Rakshasa

### Individual B Gana
Deva/Manushya/Rakshasa

### Gana Pairing
Pairing type

### Interpretation
- Temperamental harmony
- Conflict resolution capacity

---

## SECTION 7: DOSHA ANALYSIS

### Manglik Dosha
- **Present:** yes/no
- **Severity:** percentage
- **Symmetrical:** yes/no

### Nadi Dosha
- **Present:** yes/no
- **Cancelled:** yes/no

### Bhakoot Dosha
- **Present:** yes/no
- **Cancelled:** yes/no

### Other Doshas
List all additional doshas if any

---

## SECTION 8: CHART-LEVEL FACTORS

### Seventh House Notes
Rendered verbatim from input

### Navamsha Notes
Rendered verbatim from input

---

## SECTION 9: TIMING CONSIDERATIONS

### Current Dashas
List active Mahadasha and Antardasha

### Major Transits
List relevant planetary transits

### Timing Interpretation
- Relationship support periods
- Stress or testing periods

---

## SECTION 10: SYNTHESIS AND CONCLUSION

### Compatibility Summary
- Numeric compatibility outcome
- Key strengths
- Key challenges

### Final Assessment
- Proceed with caution recommended
- Proceed with remedies
- Highly favorable
- Not recommended

---

## SECTION 11: REMEDIAL MEASURES

**Rendered only if `allow_remedies` is true.**

### Recommended Remedies
- Pujas
- Lifestyle adjustments
- Timing recommendations

---

## SECTION 12: DISCLAIMERS

This report is based on classical Jyotish principles.  
It does not replace personal judgment or professional consultation.  
Interpretations are symbolic and culturally contextual.

---

**END OF DOCUMENT**
