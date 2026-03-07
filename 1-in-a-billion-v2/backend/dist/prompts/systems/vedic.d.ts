/**
 * VEDIC ASTROLOGY (JYOTISH) SYSTEM GUIDANCE
 *
 * Expert instructions for Vedic/Sidereal astrology analysis.
 *
 * Source: docs/VEDIC_HOROSCOPE_WRITING_GUIDE.md
 * Architecture: docs/PROMPT_SYSTEM_ARCHITECTURE.md (Section 2.6 SYSTEMS)
 *
 * CRITICAL: Each system uses "their" language - Vedic uses ONLY Vedic terminology.
 * See PROMPT_SYSTEM_ARCHITECTURE.md for how other systems (Gene Keys, Kabbalah)
 * also use their own terminology. Vedic must NEVER mix with Western concepts.
 *
 * PHILOSOPHY: Dark, deterministic, fatalistic with ironic humor.
 * PERSPECTIVE: Left-handed Vamachara/Kaula - everything through Rahu and dark planets.
 * EXPLANATIONS: Immediate fairy tale level - like grandfather to child.
 */
export declare const VEDIC_SYSTEM: {
    name: string;
    individualCoverage: string;
    synastryAdditions: string;
    emphasis: string;
    avoid: string;
    specialNote: string;
    accessibilityNote: string;
    toneNote: string;
};
/**
 * Build Vedic system guidance section
 */
export declare function buildVedicSection(isRelationship: boolean, spiceLevel: number): string;
//# sourceMappingURL=vedic.d.ts.map