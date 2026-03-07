"use strict";
/**
 * VECTORIZED VEDIC MATCHMAKING TYPE DEFINITIONS
 *
 * This file defines the numeric-indexed type system for high-performance
 * vectorized Vedic Jyotish matchmaking as specified in VECTORIZED_BATCH_MATCHER.md
 *
 * All types use numeric indices (0-based) for O(1) lookup table access.
 * String-based types are defined in vedic_matchmaking.types.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHA_LORD_NAMES = exports.VARNA_NAMES = exports.NADI_NAMES = exports.GANA_NAMES = exports.RASHI_NAMES = exports.NAKSHATRA_NAMES = void 0;
// ============================================================================
// NAKSHATRA AND RASHI MAPPINGS
// ============================================================================
/**
 * Ordered list of Nakshatra names for index conversion
 */
exports.NAKSHATRA_NAMES = [
    'Ashwini', 'Bharani', 'Krittika',
    'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati',
    'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha',
    'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];
/**
 * Ordered list of Rashi names for index conversion
 */
exports.RASHI_NAMES = [
    'Aries', 'Taurus', 'Gemini',
    'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius',
    'Capricorn', 'Aquarius', 'Pisces'
];
/**
 * Ordered list of Gana names for index conversion
 */
exports.GANA_NAMES = ['Deva', 'Manushya', 'Rakshasa'];
/**
 * Ordered list of Nadi names for index conversion
 */
exports.NADI_NAMES = ['Adi', 'Madhya', 'Antya'];
/**
 * Ordered list of Varna names for index conversion
 */
exports.VARNA_NAMES = ['Brahmin', 'Kshatriya', 'Vaishya', 'Shudra'];
/**
 * Ordered list of Dasha lord names for index conversion
 */
exports.DASHA_LORD_NAMES = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'
];
//# sourceMappingURL=vedic_ashtakoota.vectorized.types.js.map