# VEDIC MATCHMAKING SPECIFICATION

## Purpose and Scope

This document defines the canonical ruleset for Vedic Jyotish matchmaking used in the system. It specifies how compatibility between two individuals is calculated, evaluated, and interpreted using classical Indian astrological principles. This specification is deterministic. No component may invent rules, scores, or interpretations that are not explicitly defined here.

This specification currently applies only to Vedic Jyotish matchmaking. Other astrological systems are out of scope.

This document governs backend logic only. Frontend components may display results but may not alter logic, scoring, thresholds, or conclusions.

## Foundational Principle

All compatibility analysis is rooted in the **Moon-based Nakshatra system**. The Janma Nakshatra of each individual is the primary key from which all Koota attributes are derived. Zodiac signs, Sun signs, or Western astrology constructs are not used in this system.

## Inputs Required Per Individual

Each individual must have the following computed and available before matchmaking begins:

1. Date of birth in Gregorian calendar
2. Exact time of birth with timezone
3. Place of birth with latitude and longitude
4. Computed Moon position (sidereal)
5. Computed Janma Nakshatra
6. Computed Rashi (Moon sign, sidereal)
7. Computed Navamsha chart
8. Computed planetary positions for classical Grahas

**If any of these are missing, matchmaking must not proceed.**

## Core Compatibility Framework

The primary compatibility framework is the **Ashtakoota system**. This system evaluates compatibility across 8 attributes with a total possible score of 36 points.

A minimum score of **18 points** is required for basic viability. Scores below this threshold indicate structural incompatibility.

Scores above this threshold indicate increasing degrees of harmony but never override specific Doshas defined later.

## Ashtakoota Attributes and Scoring

### 1. Varna Koota (1 point)

**Varna** represents spiritual orientation and ego structure. It reflects how partners relate to authority, purpose, and inner hierarchy.

**Maximum score:** 1 point

Scoring is derived from the Varna associated with each partner's Moon Nakshatra. If Varna compatibility conditions are met, 1 point is awarded. Otherwise 0 points are awarded.

### 2. Vashya Koota (2 points)

**Vashya** represents mutual influence, attraction dynamics, and behavioral dominance patterns.

**Maximum score:** 2 points

Scoring depends on whether the Moon Rashi of one partner is considered influence-compatible with the other according to classical Vashya rules.

Partial scores are allowed.

### 3. Tara Koota (3 points)

**Tara** represents health, longevity, and mutual protection within the relationship.

**Maximum score:** 3 points

Scoring is determined by counting Nakshatra distance cycles between partners and applying Tara classification rules.

A failed Tara Koota indicates potential strain on shared vitality.

### 4. Yoni Koota (4 points)

**Yoni** represents instinctual nature, sexual compatibility, emotional bonding, subconscious comfort, and karmic resonance.

**Maximum score:** 4 points

Each Janma Nakshatra is assigned one of the following 14 Yoni types:

| Yoni | Animal |
|------|--------|
| Ashwa | Horse |
| Gaja | Elephant |
| Mesha | Sheep/Goat |
| Sarpa | Serpent |
| Shwan | Dog |
| Marjara | Cat |
| Mushak | Rat |
| Gau | Cow |
| Mahish | Buffalo |
| Vyaghra | Tiger |
| Mriga | Deer |
| Vanar | Monkey |
| Nakul | Mongoose |
| Simha | Lion |

Yoni compatibility is determined by classical friendly, neutral, and enemy relationships between animal types.

- **Friendly Yoni relations** receive full points
- **Neutral relations** receive partial points
- **Enemy relations** reduce points significantly and must be explained narratively

Yoni scoring is never binary. Partial points must be supported.

### 5. Graha Maitri Koota (5 points)

**Graha Maitri** represents mental compatibility, communication, and intellectual harmony.

**Maximum score:** 5 points

Scoring is based on friendship between the ruling lords of each partner's Moon sign.

High Graha Maitri strengthens the relationship even when other factors are weaker.

### 6. Gana Koota (6 points)

**Gana** represents temperament, ethical orientation, and instinctive behavior patterns.

The three Ganas are:
- **Deva** (divine, gentle, refined)
- **Manushya** (human, balanced, practical)
- **Rakshasa** (demonic, intense, aggressive)

**Maximum score:** 6 points

Compatible Gana combinations receive higher scores. Incompatible combinations reduce score and must be explained as differences in impulse regulation, emotional volatility, or moral framing.

Gana mismatch does not automatically reject a match but weakens stability.

### 7. Bhakoot Koota (7 points)

**Bhakoot** represents emotional bonding, financial harmony, family life, and long-term cohesion.

**Maximum score:** 7 points

Scoring is based on Rashi distance relationships. Certain distances are considered harmful and result in zero score.

Bhakoot failure significantly weakens long-term viability even when other scores are high.

### 8. Nadi Koota (8 points)

**Nadi** represents genetic compatibility, health of progeny, energetic rhythm, and deep physiological resonance.

**Maximum score:** 8 points

There are three Nadis:
- **Adi** (Vata)
- **Madhya** (Pitta)
- **Antya** (Kapha)

Each Nakshatra belongs to exactly one Nadi.

**If both partners belong to the same Nadi, Nadi Dosha is triggered.**

Nadi Dosha is critical and must always be surfaced explicitly.

Nadi Dosha may be softened but never ignored. Cancellation conditions must be evaluated and documented.

## Compatibility Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0-17 | Low compatibility. Marriage or long-term partnership is generally not recommended. |
| 18-24 | Average compatibility with conscious effort required. |
| 25-32 | Very good compatibility. |
| 33-36 | Exceptional compatibility. |

**Score alone does not override Doshas.**

## Dosha Analysis

Doshas represent structural stress patterns. They operate independently of point scores.

### Nadi Dosha

**Triggered when:** Both partners share the same Nadi.

**Traditional Implications:**

Nadi Dosha is one of the most serious compatibility concerns in Vedic matchmaking. When both partners belong to the same Nadi (energy type), it creates fundamental disharmony across multiple life domains:

1. **Emotional Clashes and Marital Discord**
   - Similar emotional tendencies lead to stubbornness and lack of complementarity
   - Frequent arguments and misunderstandings
   - Difficulty providing mutual emotional support during stress
   - Potential for separation due to accumulated friction

2. **Financial Instability**
   - Challenges in building or maintaining shared wealth
   - Conflicting approaches to money management and resource allocation
   - Financial stress amplifies relationship tension
   - Difficulty achieving economic stability as a unit

3. **Progeny Problems and Fertility Challenges**
   - Classical primary concern: health issues for offspring
   - Difficulties conceiving or genetic disorders
   - Miscarriages or complications during childbirth
   - Karmic implications for lineage continuation

4. **Weakened Vitality in the Couple**
   - Reduced combined life force and resilience as a partnership
   - Mutual energy drain rather than mutual energization
   - Chronic health problems affecting both partners or their children
   - Difficulty sustaining long-term partnership momentum

**Cancellation conditions** may include:
- High total Guna score (28+)
- Strong Graha Maitri (mental compatibility offsets physiological mismatch)
- Both partners in the same Nakshatra (rare exception)
- Specific remedial measures (Nadi Dosha Nivaran Puja, mantras)

Cancellation must be explicitly stated and justified.

**Interpretive Requirement:**
When Nadi Dosha is present, the analysis MUST explicitly mention at least two of the four traditional consequences in the compatibility verdict, even if the overall Ashtakoota score is high. The severity must be balanced against other horoscope factors, but never hidden or minimized.

### Manglik Dosha

Manglik Dosha is evaluated separately from Ashtakoota.

Mars placement is analyzed relative to key houses (1st, 4th, 7th, 8th, 12th from Lagna, Moon, and Venus).

Manglik severity is graded, not binary.

**If both partners are Manglik**, cancellation may apply.

**If one partner is Manglik and the other is not**, severity must be evaluated and explained.

Manglik analysis must conclude with a clear recommendation.

### Additional Doshas

**Rajjju Dosha** and **Vedha Dosha** may be evaluated if system configuration enables them.

If present, they must be reported clearly and affect conclusions accordingly.

## Dashakoota System

Dashakoota is an alternative Nakshatra-based compatibility system primarily used in South Indian traditions.

It consists of 10 attributes and also totals 36 points.

**Dashakoota is currently defined but inactive.**

Implementation must preserve Dashakoota definitions for future activation without refactoring.

## Seventh House and Chart-Based Modifiers

The 7th house governs marriage and partnership dynamics.

The following must be evaluated qualitatively:

1. Strength of the 7th house
2. Placement and dignity of the 7th house lord
3. Aspects to the 7th house
4. Navamsha correlation of the 7th house and lord

These factors modify interpretation but do not alter the 36-point score.

## Transits and Dasha Analysis

Planetary transits and Vimshottari Dasha periods affect timing, stress, and activation of relationship themes.

They do not change compatibility itself.

They must be reported as temporal overlays, not compatibility judgments.

## Conclusion Generation Rules

Every conclusion must explicitly state its scope.

It must specify which systems were used and which were not.

### Example Structure:

1. Compatibility score summary
2. Dosha summary
3. Strengths
4. Challenges
5. Final recommendation
6. Scope disclaimer

**Conclusions must never claim absolute certainty.**

## Determinism Rule

All outputs must be reproducible given the same inputs.

No randomness, creativity, or improvisation is permitted at the logic level.

Interpretive language is permitted only after rules have been applied.

## Final Authority

This document is the highest authority for Vedic matchmaking logic in the system.

Any component that contradicts it is invalid.

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-05  
**Status:** Canonical Reference
