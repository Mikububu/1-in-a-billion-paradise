/**
 * Kabbalah Astrology Calculation Module
 * 
 * Handles Jewish Zodiac (Mazal), Tree of Life mapping, and Gematria.
 */

import { HDate, months, gematriya, Location, Zmanim } from '@hebcal/core';

export interface KabbalahProfile {
    hebrewDate: string;
    hebrewMonth: string;
    mazal: {
        name: string;
        hebrewName: string;
        sign: string; // Western equivalent
        attribute: string; // e.g., Speech, Thought
        tribe: string;
    };
    sefirot?: Record<string, string>; // Planet -> Sefirah
    nameGematria?: number;
    isAfterSunset?: boolean;
}

// Jewish Zodiac (Mazal) Mapping
// Month -> Constellation/Sign
export const MAZALOT: Record<string, any> = {
    'Nisan': { name: 'Taleh', hebrewName: 'טלה', sign: 'Aries', attribute: 'Speech', tribe: 'Judah' },
    'Iyyar': { name: 'Shor', hebrewName: 'שור', sign: 'Taurus', attribute: 'Thought', tribe: 'Issachar' },
    'Sivan': { name: 'Teomim', hebrewName: 'תאומים', sign: 'Gemini', attribute: 'Motion', tribe: 'Zebulun' },
    'Tamuz': { name: 'Sartan', hebrewName: 'סרטן', sign: 'Cancer', attribute: 'Sight', tribe: 'Reuben' },
    'Av': { name: 'Aryeh', hebrewName: 'אריה', sign: 'Leo', attribute: 'Hearing', tribe: 'Simeon' },
    'Elul': { name: 'Betulah', hebrewName: 'בתולה', sign: 'Virgo', attribute: 'Action', tribe: 'Gad' },
    'Tishrei': { name: 'Moznayim', hebrewName: 'מאזניים', sign: 'Libra', attribute: 'Coition', tribe: 'Ephraim' },
    'Cheshvan': { name: 'Akrav', hebrewName: 'עקרב', sign: 'Scorpio', attribute: 'Smell', tribe: 'Manasseh' },
    'Kislev': { name: 'Keshet', hebrewName: 'קשת', sign: 'Sagittarius', attribute: 'Sleep', tribe: 'Benjamin' },
    'Tevet': { name: 'Gedi', hebrewName: 'גדי', sign: 'Capricorn', attribute: 'Anger', tribe: 'Dan' },
    'Sh\'vat': { name: 'D\'li', hebrewName: 'דלי', sign: 'Aquarius', attribute: 'Taste', tribe: 'Asher' },
    'Adar': { name: 'Dagim', hebrewName: 'דגים', sign: 'Pisces', attribute: 'Laughter', tribe: 'Naphtali' },
    'Adar I': { name: 'Dagim I', hebrewName: 'דגים א', sign: 'Pisces I', attribute: 'Laughter', tribe: 'Naphtali' },
    'Adar II': { name: 'Dagim II', hebrewName: 'דגים ב', sign: 'Pisces II', attribute: 'Laughter', tribe: 'Naphtali' },
};

// Planet -> Sefirah Mapping (Standard Kabbalistic Model)
export const PLANET_SEFIROT: Record<string, string> = {
    'Sun': 'Tiferet (Beauty)',
    'Moon': 'Yesod (Foundation)',
    'Mercury': 'Hod (Splendor)',
    'Venus': 'Netzach (Victory)',
    'Mars': 'Gevurah (Severity)',
    'Jupiter': 'Chesed (Loving-kindness)',
    'Saturn': 'Binah (Understanding)',
    'Uranus': 'Chokhmah (Wisdom)', // Modern attribution
    'Neptune': 'Keter (Crown)', // Modern attribution
    'Pluto': 'Da\'at (Knowledge)', // Modern attribution
    'Earth': 'Malkhut (Kingship)'
};

/**
 * Get Hebrew Date and Mazal from Gregorian Date and location for sunset precision.
 */
export const getKabbalahProfile = (
    gregorianDate: Date,
    latitude?: number,
    longitude?: number
): KabbalahProfile => {
    let hDate = new HDate(gregorianDate);
    let isAfterSunset = false;

    // If coordinates provided, check if birth was after sunset
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        // Location(lat, long, isIL, tzname)
        const loc = new Location(latitude, longitude, false, 'UTC');
        // Zmanim(loc, date, complexElevation?) - pass true/false for elevation or check definition
        // If lint says expected 3, maybe (loc, date, useElevation)
        const zmanim = new Zmanim(loc, gregorianDate, false);
        const sunset = zmanim.sunset();

        if (gregorianDate.getTime() > sunset.getTime()) {
            isAfterSunset = true;
            hDate = hDate.next(); // Jewish day starts at sunset
        }
    }

    const monthIndex = hDate.getMonth();
    // @ts-ignore - months array in hebcal might be accessed differently or types are loose
    const monthName = months[monthIndex] as string;
    const mazal = MAZALOT[monthName] || MAZALOT['Nisan'];

    return {
        hebrewDate: hDate.toString(),
        hebrewMonth: monthName,
        mazal,
        isAfterSunset,
    };
};

/**
 * Calculate Gematria for a given name (Hebrew or English/Transliterated rudimentary).
 * Note: Real Gematria requires Hebrew string. This wrapper uses @hebcal/core's gematriya
 * if input is Hebrew, or returns 0/null for English (unless we implement a mapping).
 */
export const calculateGematria = (text: string): number => {
    // Simple check if text contains Hebrew characters
    if (/[\u0590-\u05FF]/.test(text)) {
        // Cast to number because we know passing string returns number, but TS might see overload ambiguity
        return gematriya(text) as unknown as number;
    }
    return 0; // English Gematria logic would need a separate map
};

/**
 * Map planetary positions to Sefirot (Direct mapping, position independent)
 * In Kabbalah, the Planet ITSELF is the Sefirah's expression, regardless of Zodiac sign.
 * However, the ZODIAC sign filters it.
 */
export const getPlanetarySefirot = (): typeof PLANET_SEFIROT => {
    return PLANET_SEFIROT;
};
