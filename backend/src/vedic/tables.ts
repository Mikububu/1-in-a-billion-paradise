import { BhakootDoshaType, Gana, Nadi, Nakshatra, TaraType, YoniRelationship } from './types';

export const RASHI_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const NAKSHATRA_NAMES = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

type RashiName = (typeof RASHI_NAMES)[number];

const RASHI_INDEX = new Map<string, number>(RASHI_NAMES.map((value, index) => [value, index]));
const NAKSHATRA_INDEX = new Map<string, number>(NAKSHATRA_NAMES.map((value, index) => [value, index]));

const VARNA_RANK_BY_SIGN: Record<RashiName, number> = {
    Aries: 2,
    Taurus: 1,
    Gemini: 0,
    Cancer: 3,
    Leo: 2,
    Virgo: 1,
    Libra: 0,
    Scorpio: 3,
    Sagittarius: 2,
    Capricorn: 1,
    Aquarius: 0,
    Pisces: 3,
};

const VASHYA_COMPATIBILITY: Record<RashiName, readonly RashiName[]> = {
    Aries: ['Leo', 'Scorpio'],
    Taurus: ['Cancer', 'Libra'],
    Gemini: ['Virgo'],
    Cancer: ['Scorpio', 'Pisces'],
    Leo: ['Libra'],
    Virgo: ['Gemini', 'Pisces'],
    Libra: ['Capricorn', 'Virgo'],
    Scorpio: ['Cancer'],
    Sagittarius: ['Pisces'],
    Capricorn: ['Aries', 'Aquarius'],
    Aquarius: ['Aries'],
    Pisces: ['Capricorn'],
};

const TARA_TYPE_BY_REMAINDER: Record<number, TaraType> = {
    0: 'parama_mitra',
    1: 'janma',
    2: 'sampat',
    3: 'vipat',
    4: 'kshema',
    5: 'pratyari',
    6: 'sadhaka',
    7: 'vadha',
    8: 'mitra',
};

const GOOD_TARA_REMAINDERS = new Set<number>([0, 2, 4, 6, 8]);

const NAKSHATRA_TO_YONI: readonly number[] = [
    0, 1, 2, 3, 3, 4, 5, 6, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 11, 11, 13, 0, 13, 7, 1,
];

const YONI_TABLE: readonly (readonly number[])[] = [
    [4, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 2],
    [2, 4, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 2],
    [2, 2, 4, 2, 3, 2, 3, 2, 3, 2, 3, 2, 2, 2],
    [1, 1, 2, 4, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1],
    [3, 3, 3, 1, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3],
    [1, 1, 2, 1, 2, 4, 1, 1, 2, 1, 2, 1, 1, 1],
    [2, 2, 3, 1, 3, 1, 4, 1, 3, 2, 3, 2, 1, 2],
    [1, 1, 2, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1],
    [3, 3, 3, 2, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3],
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 4, 3, 2, 1, 2],
    [3, 3, 3, 2, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3],
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 4, 1, 2],
    [1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 4, 1],
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 4],
];

const RASHI_LORD_BY_SIGN: Record<RashiName, Planet> = {
    Aries: 'Mars',
    Taurus: 'Venus',
    Gemini: 'Mercury',
    Cancer: 'Moon',
    Leo: 'Sun',
    Virgo: 'Mercury',
    Libra: 'Venus',
    Scorpio: 'Mars',
    Sagittarius: 'Jupiter',
    Capricorn: 'Saturn',
    Aquarius: 'Saturn',
    Pisces: 'Jupiter',
};

type Planet = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn';

type PlanetRelation = 'friend' | 'neutral' | 'enemy';

const PLANET_RELATIONS: Record<Planet, Record<Planet, PlanetRelation>> = {
    Sun: {
        Sun: 'friend', Moon: 'friend', Mars: 'friend', Mercury: 'neutral', Jupiter: 'friend', Venus: 'enemy', Saturn: 'enemy',
    },
    Moon: {
        Sun: 'friend', Moon: 'friend', Mars: 'neutral', Mercury: 'friend', Jupiter: 'neutral', Venus: 'neutral', Saturn: 'neutral',
    },
    Mars: {
        Sun: 'friend', Moon: 'friend', Mars: 'friend', Mercury: 'enemy', Jupiter: 'friend', Venus: 'neutral', Saturn: 'neutral',
    },
    Mercury: {
        Sun: 'friend', Moon: 'enemy', Mars: 'neutral', Mercury: 'friend', Jupiter: 'neutral', Venus: 'friend', Saturn: 'neutral',
    },
    Jupiter: {
        Sun: 'friend', Moon: 'friend', Mars: 'friend', Mercury: 'enemy', Jupiter: 'friend', Venus: 'enemy', Saturn: 'neutral',
    },
    Venus: {
        Sun: 'enemy', Moon: 'enemy', Mars: 'neutral', Mercury: 'friend', Jupiter: 'neutral', Venus: 'friend', Saturn: 'friend',
    },
    Saturn: {
        Sun: 'enemy', Moon: 'enemy', Mars: 'enemy', Mercury: 'friend', Jupiter: 'neutral', Venus: 'friend', Saturn: 'friend',
    },
};

const GANA_BY_NAKSHATRA: Record<Nakshatra, Gana> = {
    Ashwini: 'deva',
    Bharani: 'manushya',
    Krittika: 'rakshasa',
    Rohini: 'manushya',
    Mrigashira: 'deva',
    Ardra: 'rakshasa',
    Punarvasu: 'deva',
    Pushya: 'deva',
    Ashlesha: 'rakshasa',
    Magha: 'rakshasa',
    'Purva Phalguni': 'manushya',
    'Uttara Phalguni': 'manushya',
    Hasta: 'deva',
    Chitra: 'rakshasa',
    Swati: 'deva',
    Vishakha: 'rakshasa',
    Anuradha: 'deva',
    Jyeshtha: 'rakshasa',
    Mula: 'rakshasa',
    'Purva Ashadha': 'manushya',
    'Uttara Ashadha': 'manushya',
    Shravana: 'deva',
    Dhanishta: 'rakshasa',
    Shatabhisha: 'rakshasa',
    'Purva Bhadrapada': 'manushya',
    'Uttara Bhadrapada': 'manushya',
    Revati: 'deva',
};

const GANA_SCORE_MATRIX: Record<Gana, Record<Gana, number>> = {
    deva: { deva: 6, manushya: 5, rakshasa: 1 },
    manushya: { deva: 5, manushya: 6, rakshasa: 3 },
    rakshasa: { deva: 1, manushya: 3, rakshasa: 6 },
};

const NADI_BY_NAKSHATRA: Record<Nakshatra, Nadi> = {
    Ashwini: 'adi',
    Bharani: 'madhya',
    Krittika: 'antya',
    Rohini: 'adi',
    Mrigashira: 'madhya',
    Ardra: 'antya',
    Punarvasu: 'adi',
    Pushya: 'madhya',
    Ashlesha: 'antya',
    Magha: 'adi',
    'Purva Phalguni': 'madhya',
    'Uttara Phalguni': 'antya',
    Hasta: 'adi',
    Chitra: 'madhya',
    Swati: 'antya',
    Vishakha: 'adi',
    Anuradha: 'madhya',
    Jyeshtha: 'antya',
    Mula: 'adi',
    'Purva Ashadha': 'madhya',
    'Uttara Ashadha': 'antya',
    Shravana: 'adi',
    Dhanishta: 'madhya',
    Shatabhisha: 'antya',
    'Purva Bhadrapada': 'adi',
    'Uttara Bhadrapada': 'madhya',
    Revati: 'antya',
};

const BHAKOOT_BAD_DISTANCES = new Set<number>([2, 6, 8, 12]);

export function isNakshatra(value: string): value is Nakshatra {
    return NAKSHATRA_INDEX.has(value);
}

function getRashiIndex(value: string): number {
    return RASHI_INDEX.get(value) ?? -1;
}

function getNakshatraIndex(value: string): number {
    return NAKSHATRA_INDEX.get(value) ?? -1;
}

export function getVarnaScore(moonSignA: string, moonSignB: string): number {
    if (!RASHI_INDEX.has(moonSignA) || !RASHI_INDEX.has(moonSignB)) {
        return 0;
    }

    const rankA = VARNA_RANK_BY_SIGN[moonSignA as RashiName];
    const rankB = VARNA_RANK_BY_SIGN[moonSignB as RashiName];
    return rankA >= rankB ? 1 : 0;
}

export function getVashyaScore(moonSignA: string, moonSignB: string): number {
    if (!RASHI_INDEX.has(moonSignA) || !RASHI_INDEX.has(moonSignB)) {
        return 0;
    }

    const signA = moonSignA as RashiName;
    const signB = moonSignB as RashiName;

    if (signA === signB) {
        return 2;
    }

    return VASHYA_COMPATIBILITY[signA].includes(signB) ? 2 : 0;
}

export function getTaraTypeAndScore(moonNakshatraA: Nakshatra, moonNakshatraB: Nakshatra): { tara_type: TaraType; score: number } {
    const indexA = getNakshatraIndex(moonNakshatraA);
    const indexB = getNakshatraIndex(moonNakshatraB);

    if (indexA === -1 || indexB === -1) {
        return { tara_type: 'janma', score: 0 };
    }

    const distance = ((indexA - indexB + 27) % 27) + 1;
    const remainder = distance % 9;
    return {
        tara_type: TARA_TYPE_BY_REMAINDER[remainder],
        score: GOOD_TARA_REMAINDERS.has(remainder) ? 3 : 0,
    };
}

export function getTaraScore(moonNakshatraA: Nakshatra, moonNakshatraB: Nakshatra): number {
    return getTaraTypeAndScore(moonNakshatraA, moonNakshatraB).score;
}

export function getYoniScore(moonNakshatraA: Nakshatra, moonNakshatraB: Nakshatra): number {
    const indexA = getNakshatraIndex(moonNakshatraA);
    const indexB = getNakshatraIndex(moonNakshatraB);

    if (indexA === -1 || indexB === -1) {
        return 2;
    }

    const yoniA = NAKSHATRA_TO_YONI[indexA];
    const yoniB = NAKSHATRA_TO_YONI[indexB];

    if (yoniA === undefined || yoniB === undefined) {
        return 2;
    }

    return YONI_TABLE[yoniA]?.[yoniB] ?? 2;
}

export function yoniRelationshipFromScore(score: number): YoniRelationship {
    if (score >= 3) {
        return 'friendly';
    }
    if (score >= 2) {
        return 'neutral';
    }
    return 'enemy';
}

function relationToWeight(relation: PlanetRelation): number {
    if (relation === 'friend') {
        return 2;
    }
    if (relation === 'neutral') {
        return 1;
    }
    return 0;
}

export function getGrahaMaitriScore(moonSignA: string, moonSignB: string): number {
    if (!RASHI_INDEX.has(moonSignA) || !RASHI_INDEX.has(moonSignB)) {
        return 1;
    }

    const lordA = RASHI_LORD_BY_SIGN[moonSignA as RashiName];
    const lordB = RASHI_LORD_BY_SIGN[moonSignB as RashiName];

    if (lordA === lordB) {
        return 5;
    }

    const relationAB = relationToWeight(PLANET_RELATIONS[lordA][lordB]);
    const relationBA = relationToWeight(PLANET_RELATIONS[lordB][lordA]);

    if (relationAB === 2 && relationBA === 2) {
        return 5;
    }
    if ((relationAB === 2 && relationBA === 1) || (relationAB === 1 && relationBA === 2)) {
        return 4;
    }
    if (relationAB === 1 && relationBA === 1) {
        return 1;
    }
    if ((relationAB === 2 && relationBA === 0) || (relationAB === 0 && relationBA === 2)) {
        return 1;
    }
    if ((relationAB === 1 && relationBA === 0) || (relationAB === 0 && relationBA === 1)) {
        return 1;
    }

    return 0;
}

export function getGanaScore(moonNakshatraA: Nakshatra, moonNakshatraB: Nakshatra): number {
    const ganaA = GANA_BY_NAKSHATRA[moonNakshatraA];
    const ganaB = GANA_BY_NAKSHATRA[moonNakshatraB];
    return GANA_SCORE_MATRIX[ganaA][ganaB];
}

function bhakootDistance(signA: string, signB: string): number | null {
    const indexA = getRashiIndex(signA);
    const indexB = getRashiIndex(signB);

    if (indexA === -1 || indexB === -1) {
        return null;
    }

    return ((indexB - indexA + 12) % 12) + 1;
}

export function getBhakootScore(moonSignA: string, moonSignB: string): number {
    const distance = bhakootDistance(moonSignA, moonSignB);

    if (distance == null) {
        return 0;
    }

    return BHAKOOT_BAD_DISTANCES.has(distance) ? 0 : 7;
}

export function getBhakootDoshaType(moonSignA: string, moonSignB: string): BhakootDoshaType {
    const distance = bhakootDistance(moonSignA, moonSignB);

    if (distance == null) {
        return 'none';
    }

    if (distance === 2 || distance === 12) {
        return 'dwirdwadasha';
    }

    if (distance === 6 || distance === 8) {
        return 'shadashtaka';
    }

    return 'none';
}

export function getNadiFromNakshatra(moonNakshatra: Nakshatra): Nadi {
    return NADI_BY_NAKSHATRA[moonNakshatra];
}

export function getNadiScore(moonNakshatraA: Nakshatra, moonNakshatraB: Nakshatra): number {
    const nadiA = getNadiFromNakshatra(moonNakshatraA);
    const nadiB = getNadiFromNakshatra(moonNakshatraB);
    return nadiA === nadiB ? 0 : 8;
}
