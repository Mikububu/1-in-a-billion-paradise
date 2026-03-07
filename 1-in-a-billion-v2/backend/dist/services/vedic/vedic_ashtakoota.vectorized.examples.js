"use strict";
/**
 * EXAMPLE: Using Vectorized Types
 *
 * This file demonstrates how to use the new vectorized type system
 * for high-performance Vedic matchmaking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToVector = convertToVector;
exports.deriveAttributes = deriveAttributes;
exports.prepareBatchInput = prepareBatchInput;
const vedic_ashtakoota_converters_1 = require("./vedic_ashtakoota.converters");
// ============================================================================
// EXAMPLE 1: Converting String-Based Person to Vectorized Format
// ============================================================================
/**
 * Convert a string-based VedicPerson to numeric VedicPersonVector
 */
function convertToVector(person) {
    const nakshatraIndex = (0, vedic_ashtakoota_converters_1.nakshatraToIndex)(person.moon_nakshatra);
    const rashiIndex = (0, vedic_ashtakoota_converters_1.rashiToIndex)(person.moon_sign);
    const ascendantIndex = (0, vedic_ashtakoota_converters_1.rashiToIndex)(person.ascendant);
    return {
        person_id: person.id,
        moon_nakshatra: nakshatraIndex,
        moon_rashi: rashiIndex,
        ascendant: ascendantIndex,
        mars_house: person.mars_house,
        jupiter_house: person.jupiter_house,
        venus_house: person.venus_house,
        saturn_house: person.saturn_house,
        dasha_lord: (0, vedic_ashtakoota_converters_1.dashaLordToIndex)(person.dasha_lord),
        sub_dasha_lord: (0, vedic_ashtakoota_converters_1.dashaLordToIndex)(person.sub_dasha_lord)
    };
}
// ============================================================================
// EXAMPLE 2: Sample Vectorized Persons
// ============================================================================
const personA = {
    person_id: 'user_123',
    moon_nakshatra: 9, // Magha
    moon_rashi: 4, // Leo
    ascendant: 0, // Aries
    mars_house: 7, // 7th house (Manglik)
    jupiter_house: 5,
    venus_house: 2,
    saturn_house: 10,
    dasha_lord: 0, // Sun
    sub_dasha_lord: 2 // Mars
};
const personB = {
    person_id: 'user_456',
    moon_nakshatra: 26, // Revati
    moon_rashi: 11, // Pisces
    ascendant: 3, // Cancer
    mars_house: 1, // 1st house (Manglik)
    jupiter_house: 9,
    venus_house: 7,
    saturn_house: 4,
    dasha_lord: 4, // Jupiter
    sub_dasha_lord: 1 // Moon
};
// ============================================================================
// EXAMPLE 3: Expected Vectorized Match Result Structure
// ============================================================================
const exampleMatchResult = {
    total_guna: 24,
    koota_breakdown: {
        varna: 1,
        vashya: 0,
        tara: 3,
        yoni: 4,
        graha_maitri: 4,
        gana: 6,
        bhakoot: 0,
        nadi: 8,
        total_guna: 26
    },
    doshas: {
        manglik: false, // Both are Manglik, so it cancels
        nadi: false, // Different Nadi
        bhakoot: true // Inauspicious distance
    },
    flags: {
        sexual_incompatibility: false,
        severe_nadi_dosha: false,
        dasha_conflict: false,
        dasha_growth: true // Sun-Jupiter is favorable
    }
};
// ============================================================================
// EXAMPLE 4: Batch Processing Structure
// ============================================================================
const exampleBatchResults = {
    total_pairs: 100,
    pairs: [
        {
            person_a_id: 'user_123',
            person_b_id: 'user_456',
            result: exampleMatchResult
        }
        // ... 99 more pairs
    ],
    metadata: {
        processing_time_ms: 45,
        early_rejections: 12
    }
};
// ============================================================================
// EXAMPLE 5: Using Attribute Lookup Tables
// ============================================================================
/**
 * Derive all attributes from just Nakshatra and Rashi indices
 */
function deriveAttributes(nakshatraIndex, rashiIndex) {
    return {
        gana: (0, vedic_ashtakoota_converters_1.getGanaFromNakshatra)(nakshatraIndex),
        nadi: (0, vedic_ashtakoota_converters_1.getNadiFromNakshatra)(nakshatraIndex),
        yoni: (0, vedic_ashtakoota_converters_1.getYoniFromNakshatra)(nakshatraIndex),
        varna: (0, vedic_ashtakoota_converters_1.getVarnaFromRashi)(rashiIndex),
        moon_lord: (0, vedic_ashtakoota_converters_1.getLordFromRashi)(rashiIndex)
    };
}
// Example usage:
const attributes = deriveAttributes(9, 4); // Magha in Leo
console.log(attributes);
// Output: { gana: 2 (Rakshasa), nadi: 0 (Adi), yoni: 6 (Rat), varna: 1 (Kshatriya), moon_lord: 0 (Sun) }
// ============================================================================
// EXAMPLE 6: Type-Safe Batch Input
// ============================================================================
/**
 * Prepare batch input for vectorized matching
 */
function prepareBatchInput(sourcePerson, targetPersons) {
    return {
        source: sourcePerson,
        targets: targetPersons
    };
}
// ============================================================================
// NOTES FOR IMPLEMENTATION
// ============================================================================
/*
 * Next steps for vectorized engine implementation:
 *
 * 1. Implement vectorized scoring functions:
 *    - computeAshtakootaScore(a: VedicPersonVector, b: VedicPersonVector): KootaScoreVector
 *    - computeDoshas(a: VedicPersonVector, b: VedicPersonVector): DoshaFlags
 *    - computeFlags(a: VedicPersonVector, b: VedicPersonVector): CompatibilityFlags
 *    - computeFinalScore(a: VedicPersonVector, b: VedicPersonVector): VectorizedMatchResult
 *
 * 2. Implement batch processing:
 *    - vectorizedBatchMatch(source: VedicPersonVector, targets: VedicPersonVector[]): BatchMatchResults
 *    - vectorizedManyToMany(groupA: VedicPersonVector[], groupB: VedicPersonVector[]): BatchMatchResults
 *
 * 3. Use existing lookup tables from vedic_ashtakoota.vectorized.tables.ts:
 *    - VARNA_TABLE[rashiA][rashiB] -> 0 or 1
 *    - VASHYA_TABLE[rashiA][rashiB] -> 0, 1, or 2
 *    - TARA_TABLE[nakshatraA][nakshatraB] -> 0 or 3
 *    - etc.
 *
 * 4. Optimize for performance:
 *    - All lookups are O(1)
 *    - No string comparisons
 *    - No loops in scoring logic (use table lookups)
 *    - Batch operations can be parallelized
 */
//# sourceMappingURL=vedic_ashtakoota.vectorized.examples.js.map