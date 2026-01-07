/**
 * Vedic Astrology Calculation Module
 * 
 * Handles Nakshatra and Dasha calculations based on Sidereal longitudes.
 * NOTE: Longitudes passed here MUST be Sidereal (Lahiri Ayanamsa), 
 * usually fetched from the backend (Swiss Ephemeris).
 */

export interface NakshatraInfo {
    id: number;
    name: string;
    ruler: string;
    lord: string;
    pada: number;
    startLongitude: number;
    endLongitude: number;
}

export const NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

export const NAKSHATRA_LORDS = [
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu',
    'Jupiter', 'Saturn', 'Mercury'
];

// Vimshottari Dasha periods in years
export const DASHA_PERIODS: Record<string, number> = {
    'Ketu': 7,
    'Venus': 20,
    'Sun': 6,
    'Moon': 10,
    'Mars': 7,
    'Rahu': 18,
    'Jupiter': 16,
    'Saturn': 19,
    'Mercury': 17
};

/**
 * Calculate Nakshatra from Sidereal Longitude.
 * 
 * @param longitude Sidereal longitude (0-360)
 * @returns NakshatraInfo
 */
export const getNakshatra = (longitude: number): NakshatraInfo => {
    const normalizedLong = (longitude % 360 + 360) % 360;
    const nakshatraSpan = 13 + (20 / 60); // 13 degrees 20 minutes = 13.3333...

    const nakshatraIndex = Math.floor(normalizedLong / nakshatraSpan);
    const positionInNakshatra = normalizedLong % nakshatraSpan;

    // Calculate Pada (each Nakshatra has 4 Padas of 3°20' each)
    const padaSpan = 3 + (20 / 60); // 3.3333...
    const pada = Math.floor(positionInNakshatra / padaSpan) + 1;

    const name = NAKSHATRAS[nakshatraIndex];

    // Lords cycle: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
    const lordIndex = nakshatraIndex % 9;
    const lord = NAKSHATRA_LORDS[lordIndex];

    return {
        id: nakshatraIndex + 1,
        name,
        ruler: lord, // Often used interchangeably
        lord,
        pada,
        startLongitude: nakshatraIndex * nakshatraSpan,
        endLongitude: (nakshatraIndex + 1) * nakshatraSpan,
    };
};

/**
 * Calculate the current Mahadasha based on Moon's longitude and birth date.
 * 
 * @param moonLongitude Sidereal longitude of the Moon
 * @param birthDate Date object of birth
 * @param targetDate Date object to calculate dasha for (defaults to now)
 */
export const getCurrentDasha = (
    moonLongitude: number,
    birthDate: Date,
    targetDate: Date = new Date()
) => {
    const nakshatra = getNakshatra(moonLongitude);
    const nakshatraSpan = 13 + (20 / 60); // 13.3333

    const positionInNakshatra = moonLongitude - nakshatra.startLongitude;
    const percentagePassed = positionInNakshatra / nakshatraSpan;
    const percentageRemaining = 1 - percentagePassed;

    const birthLord = nakshatra.lord;
    const birthLordDuration = DASHA_PERIODS[birthLord];
    const birthBalance = birthLordDuration * percentageRemaining; // Years remaining at birth

    // Find current dasha by iterating forward from birth
    let yearsSinceBirth = (targetDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    // Start with birth lord
    if (yearsSinceBirth < birthBalance) {
        return {
            lord: birthLord,
            startDate: birthDate, // Simplified
            yearsRemaining: birthBalance - yearsSinceBirth
        };
    }

    yearsSinceBirth -= birthBalance;

    // Cycle through lords starting from next one
    let currentLordIndex = (NAKSHATRA_LORDS.indexOf(birthLord) + 1) % 9;

    while (true) {
        const currentLord = NAKSHATRA_LORDS[currentLordIndex];
        const duration = DASHA_PERIODS[currentLord];

        if (yearsSinceBirth < duration) {
            return {
                lord: currentLord,
                yearsIntoDasha: yearsSinceBirth,
                totalDuration: duration
            };
        }

        yearsSinceBirth -= duration;
        currentLordIndex = (currentLordIndex + 1) % 9;

        // Safety break for extremely far dates
        if (yearsSinceBirth < 0) break;
    }
};
