"use strict";
/**
 * VECTORIZED TABLE GENERATOR
 *
 * Generates static 2D lookup tables for O(1) vectorized matching.
 * Uses the verified scoring engine as the source of truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vedic_matchmaking_engine_1 = require("../vedic_matchmaking.engine");
// ============================================================================
// ENUM MAPPINGS
// ============================================================================
const RASHIS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];
const YONIS = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat',
    'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
const GANAS = ['deva', 'manushya', 'rakshasa'];
const NADIS = ['adi', 'madhya', 'antya'];
// ============================================================================
// TABLE GENERATORS
// ============================================================================
function generateVarnaTable() {
    const table = [];
    for (let i = 0; i < RASHIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < RASHIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreVarna)({ moon_sign: RASHIS[i], moon_nakshatra: 'Ashwini' }, { moon_sign: RASHIS[j], moon_nakshatra: 'Ashwini' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateVashyaTable() {
    const table = [];
    for (let i = 0; i < RASHIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < RASHIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreVashya)({ moon_sign: RASHIS[i], moon_nakshatra: 'Ashwini' }, { moon_sign: RASHIS[j], moon_nakshatra: 'Ashwini' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateTaraTable() {
    const table = [];
    for (let i = 0; i < NAKSHATRAS.length; i++) {
        table[i] = [];
        for (let j = 0; j < NAKSHATRAS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreTara)({ moon_nakshatra: NAKSHATRAS[i], moon_sign: 'Aries' }, { moon_nakshatra: NAKSHATRAS[j], moon_sign: 'Aries' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateYoniTable() {
    const table = [];
    // Map Yoni names to Nakshatras for lookup
    const yoniToNakshatra = {
        'Horse': 'Ashwini',
        'Elephant': 'Bharani',
        'Sheep': 'Krittika',
        'Serpent': 'Rohini',
        'Dog': 'Ardra',
        'Cat': 'Punarvasu',
        'Rat': 'Magha',
        'Cow': 'Uttara Phalguni',
        'Buffalo': 'Hasta',
        'Tiger': 'Chitra',
        'Deer': 'Anuradha',
        'Monkey': 'Purva Ashadha',
        'Mongoose': 'Uttara Ashadha',
        'Lion': 'Dhanishta'
    };
    for (let i = 0; i < YONIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < YONIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreYoni)({ moon_nakshatra: yoniToNakshatra[YONIS[i]], moon_sign: 'Aries' }, { moon_nakshatra: yoniToNakshatra[YONIS[j]], moon_sign: 'Aries' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateGrahaMaitriTable() {
    const table = [];
    for (let i = 0; i < RASHIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < RASHIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreGrahaMaitri)({ moon_sign: RASHIS[i], moon_nakshatra: 'Ashwini' }, { moon_sign: RASHIS[j], moon_nakshatra: 'Ashwini' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateGanaTable() {
    const table = [];
    // Map Gana to Nakshatra
    const ganaToNakshatra = {
        'deva': 'Ashwini',
        'manushya': 'Bharani',
        'rakshasa': 'Krittika'
    };
    for (let i = 0; i < GANAS.length; i++) {
        table[i] = [];
        for (let j = 0; j < GANAS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreGana)({ moon_nakshatra: ganaToNakshatra[GANAS[i]], moon_sign: 'Aries', gana: GANAS[i] }, { moon_nakshatra: ganaToNakshatra[GANAS[j]], moon_sign: 'Aries', gana: GANAS[j] });
            table[i][j] = score;
        }
    }
    return table;
}
function generateBhakootTable() {
    const table = [];
    for (let i = 0; i < RASHIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < RASHIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreBhakoot)({ moon_sign: RASHIS[i], moon_nakshatra: 'Ashwini' }, { moon_sign: RASHIS[j], moon_nakshatra: 'Ashwini' });
            table[i][j] = score;
        }
    }
    return table;
}
function generateNadiTable() {
    const table = [];
    // Map Nadi to Nakshatra
    const nadiToNakshatra = {
        'adi': 'Ashwini',
        'madhya': 'Bharani',
        'antya': 'Krittika'
    };
    for (let i = 0; i < NADIS.length; i++) {
        table[i] = [];
        for (let j = 0; j < NADIS.length; j++) {
            const score = (0, vedic_matchmaking_engine_1.scoreNadi)({ moon_nakshatra: nadiToNakshatra[NADIS[i]], moon_sign: 'Aries', nadi: NADIS[i] }, { moon_nakshatra: nadiToNakshatra[NADIS[j]], moon_sign: 'Aries', nadi: NADIS[j] });
            table[i][j] = score;
        }
    }
    return table;
}
// ============================================================================
// MAIN GENERATION
// ============================================================================
function generateAllTables() {
    console.log('Generating Vectorized Lookup Tables...\n');
    const varnaTable = generateVarnaTable();
    const vashyaTable = generateVashyaTable();
    const taraTable = generateTaraTable();
    const yoniTable = generateYoniTable();
    const grahaMaitriTable = generateGrahaMaitriTable();
    const ganaTable = generateGanaTable();
    const bhakootTable = generateBhakootTable();
    const nadiTable = generateNadiTable();
    console.log('✅ VARNA_TABLE (12x12):', varnaTable.length, 'x', varnaTable[0].length);
    console.log('✅ VASHYA_TABLE (12x12):', vashyaTable.length, 'x', vashyaTable[0].length);
    console.log('✅ TARA_TABLE (27x27):', taraTable.length, 'x', taraTable[0].length);
    console.log('✅ YONI_TABLE (14x14):', yoniTable.length, 'x', yoniTable[0].length);
    console.log('✅ GRAHA_MAITRI_TABLE (12x12):', grahaMaitriTable.length, 'x', grahaMaitriTable[0].length);
    console.log('✅ GANA_TABLE (3x3):', ganaTable.length, 'x', ganaTable[0].length);
    console.log('✅ BHAKOOT_TABLE (12x12):', bhakootTable.length, 'x', bhakootTable[0].length);
    console.log('✅ NADI_TABLE (3x3):', nadiTable.length, 'x', nadiTable[0].length);
    // Generate TypeScript file
    const output = `/**
 * VECTORIZED LOOKUP TABLES
 * 
 * Auto-generated from verified scoring engine.
 * DO NOT EDIT MANUALLY.
 * 
 * Generated: ${new Date().toISOString()}
 */

export const VARNA_TABLE: number[][] = ${JSON.stringify(varnaTable, null, 2)};

export const VASHYA_TABLE: number[][] = ${JSON.stringify(vashyaTable, null, 2)};

export const TARA_TABLE: number[][] = ${JSON.stringify(taraTable, null, 2)};

export const YONI_TABLE: number[][] = ${JSON.stringify(yoniTable, null, 2)};

export const GRAHA_MAITRI_TABLE: number[][] = ${JSON.stringify(grahaMaitriTable, null, 2)};

export const GANA_TABLE: number[][] = ${JSON.stringify(ganaTable, null, 2)};

export const BHAKOOT_TABLE: number[][] = ${JSON.stringify(bhakootTable, null, 2)};

export const NADI_TABLE: number[][] = ${JSON.stringify(nadiTable, null, 2)};
`;
    return output;
}
// Execute
const tablesCode = generateAllTables();
console.log('\n📦 Tables generated successfully.\n');
console.log('Copy the output below to: src/services/vedic/vedic_ashtakoota.vectorized.tables.ts\n');
console.log('─'.repeat(80));
console.log(tablesCode);
//# sourceMappingURL=generate-vectorized-tables.js.map