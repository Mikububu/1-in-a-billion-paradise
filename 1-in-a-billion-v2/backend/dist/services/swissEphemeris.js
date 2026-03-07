"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swissEngine = exports.SwissEphemerisEngine = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const luxon_1 = require("luxon");
const swisseph_1 = __importDefault(require("swisseph"));
const humanDesignCalculator_1 = require("./humanDesignCalculator");
const geneKeysCalculator_1 = require("./geneKeysCalculator");
const HebrewCalendarService_1 = require("./kabbalah/HebrewCalendarService");
const KabbalahCalculatorV2_1 = require("./kabbalah/KabbalahCalculatorV2");
/**
 * SWISS EPHEMERIS CONFIGURATION
 *
 * Swiss Ephemeris is the ONLY source of truth for astrological calculations.
 * The LLM NEVER calculates positions - it only generates text based on these results.
 *
 * Ephemeris files contain planetary position data and must be accessible in production.
 */
// Try multiple paths for ephemeris files (deployment flexibility)
const EPHE_PATHS = [
    path_1.default.resolve(__dirname, '../../ephe'), // Production: /backend/ephe
    path_1.default.resolve(__dirname, '../../node_modules/swisseph/ephe'), // Dev: node_modules
    path_1.default.resolve(process.cwd(), 'ephe'), // Docker: relative to cwd
    '/app/ephe', // Docker absolute
    './ephe', // Fallback
];
// Find the first valid ephemeris path
function findEphePath() {
    console.log('🔍 [Swiss Ephemeris] Searching for ephemeris files...');
    console.log(`[Swiss] Current working directory: ${process.cwd()}`);
    console.log(`[Swiss] __dirname: ${__dirname}`);
    for (const testPath of EPHE_PATHS) {
        try {
            console.log(`[Swiss] Testing path: ${testPath}`);
            const pathExists = fs_1.default.existsSync(testPath);
            console.log(`[Swiss]   - Path exists: ${pathExists}`);
            if (pathExists) {
                const markerFile = path_1.default.join(testPath, 'sepl_18.se1');
                const markerExists = fs_1.default.existsSync(markerFile);
                console.log(`[Swiss]   - Marker file (sepl_18.se1) exists: ${markerExists}`);
                if (markerExists) {
                    // List all files in the directory for debugging
                    try {
                        const files = fs_1.default.readdirSync(testPath);
                        console.log(`[Swiss]   - Files found (${files.length}):`, files.join(', '));
                    }
                    catch (listErr) {
                        console.warn(`[Swiss]   - Could not list files:`, listErr);
                    }
                    console.log(`✅ [Swiss Ephemeris] Using ephe path: ${testPath}`);
                    return testPath;
                }
            }
        }
        catch (err) {
            console.warn(`[Swiss]   - Error testing path ${testPath}:`, err);
        }
    }
    // Default fallback
    const defaultPath = EPHE_PATHS[0] ?? './ephe';
    console.error(`❌ [Swiss Ephemeris] No valid ephe path found! Using fallback: ${defaultPath}`);
    console.error('[Swiss] This will likely cause calculation failures!');
    return defaultPath;
}
const ephePath = findEphePath();
swisseph_1.default.swe_set_ephe_path(ephePath);
const SIGNS = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
];
// Default flags for tropical calculations.
const flags = swisseph_1.default.SEFLG_SWIEPH | swisseph_1.default.SEFLG_SPEED;
// Default flags for sidereal (Jyotish) calculations.
// SEFLG_SIDEREAL tells Swiss Ephemeris to use sidereal zodiac.
const siderealFlags = flags | swisseph_1.default.SEFLG_SIDEREAL;
/**
 * Ensure sidereal mode is set to Lahiri.
 * This should be called before any sidereal calculations.
 */
function ensureSiderealMode() {
    try {
        // Lahiri ayanamsa is the most common "Kundli app" default.
        swisseph_1.default.swe_set_sid_mode(swisseph_1.default.SE_SIDM_LAHIRI, 0, 0);
    }
    catch (e) {
        console.warn('[Swiss Ephemeris] Failed to set sidereal mode (Lahiri):', e);
    }
}
// Initial configuration
ensureSiderealMode();
const toSign = (longitude) => {
    const normalized = (longitude % 360 + 360) % 360;
    const index = Math.floor(normalized / 30);
    return SIGNS[index] ?? 'Unknown';
};
const toSignIndex = (longitude) => {
    const normalized = (longitude % 360 + 360) % 360;
    return Math.floor(normalized / 30) % 12;
};
const toDegrees = (longitude) => {
    const normalized = (longitude % 360 + 360) % 360;
    const signIndex = Math.floor(normalized / 30);
    const degreeInSign = normalized % 30;
    const degree = Math.floor(degreeInSign);
    const minute = Math.floor((degreeInSign - degree) * 60);
    return {
        sign: SIGNS[signIndex] ?? 'Unknown',
        degree,
        minute,
    };
};
const normalizeLongitude = (longitude) => (longitude % 360 + 360) % 360;
const angularDistance = (a, b) => {
    const diff = Math.abs(normalizeLongitude(a) - normalizeLongitude(b)) % 360;
    return diff > 180 ? 360 - diff : diff;
};
const MAJOR_ASPECTS = [
    { type: 'conjunction', angle: 0 },
    { type: 'sextile', angle: 60 },
    { type: 'square', angle: 90 },
    { type: 'trine', angle: 120 },
    { type: 'opposition', angle: 180 },
];
const computeMajorAspects = (points, orbDeg) => {
    const aspects = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const p1 = points[i];
            const p2 = points[j];
            const dist = angularDistance(p1.longitude, p2.longitude);
            let best = null;
            for (const def of MAJOR_ASPECTS) {
                const orb = Math.abs(dist - def.angle);
                if (orb <= orbDeg && (!best || orb < best.orb)) {
                    best = { type: def.type, orb };
                }
            }
            if (!best)
                continue;
            aspects.push({
                a: p1.name,
                b: p2.name,
                type: best.type,
                orb: Number(best.orb.toFixed(2)),
                exact: best.orb <= 1,
            });
        }
    }
    // Stable ordering for diff/debugging
    return aspects.sort((x, y) => {
        if (x.type !== y.type)
            return x.type.localeCompare(y.type);
        if (x.orb !== y.orb)
            return x.orb - y.orb;
        const ax = `${x.a}|${x.b}`;
        const ay = `${y.a}|${y.b}`;
        return ax.localeCompare(ay);
    });
};
/**
 * Calculate which house a planet is in based on house cusps
 * Swiss Ephemeris returns cusps array where cusps[0] = house 1, cusps[1] = house 2, etc.
 * Returns house number (1-12) or undefined if calculation fails
 */
const getHouse = (planetLongitude, houseCusps) => {
    // Node swisseph bindings return 12 cusps where index 0 = house 1 cusp.
    // Some environments may return 13 where index 1 = house 1 cusp (index 0 unused).
    if (!houseCusps || houseCusps.length < 12)
        return undefined;
    const normalized = (planetLongitude % 360 + 360) % 360;
    const cuspForHouse = (house) => {
        if (houseCusps.length >= 13) {
            // 1-indexed (0 unused)
            return houseCusps[house];
        }
        // 0-indexed (index 0 = house 1)
        return houseCusps[house - 1];
    };
    // Swiss Ephemeris cusps: either [house1..house12] or [unused, house1..house12]
    // Check each house (1-12)
    for (let house = 1; house <= 12; house++) {
        const nextCuspIdx = house === 12 ? 1 : house + 1; // Wrap around
        const cusp = (cuspForHouse(house) % 360 + 360) % 360;
        const nextCusp = (cuspForHouse(nextCuspIdx) % 360 + 360) % 360;
        // Handle house boundary crossing 0° (when next cusp < current cusp)
        if (cusp > nextCusp) {
            // House spans across 0° (e.g., house 12: 350° to 10°)
            if (normalized >= cusp || normalized < nextCusp) {
                return house;
            }
        }
        else {
            // Normal case (e.g., house 1: 10° to 40°)
            if (normalized >= cusp && normalized < nextCusp) {
                return house;
            }
        }
    }
    return undefined;
};
/**
 * Get decan (1st, 2nd, or 3rd third of the sign)
 * 0-10° = 1st decan, 10-20° = 2nd decan, 20-30° = 3rd decan
 */
const getDecan = (degree) => {
    if (degree < 10)
        return 1;
    if (degree < 20)
        return 2;
    return 3;
};
/**
 * Convert birth data to Julian Day for Swiss Ephemeris
 * Handles timezone conversion properly (critical for historical dates!)
 */
const toJulianDay = (payload) => {
    // Parse the date in the given timezone
    const date = luxon_1.DateTime.fromISO(`${payload.birthDate}T${payload.birthTime}`, {
        zone: payload.timezone
    });
    if (!date.isValid) {
        throw new Error(`Invalid birth date/time: ${payload.birthDate} ${payload.birthTime} in ${payload.timezone}`);
    }
    // Convert to UTC for Swiss Ephemeris
    const utc = date.toUTC();
    const fractionalHour = utc.hour + utc.minute / 60 + utc.second / 3600;
    // Calculate Julian Day
    const jd = swisseph_1.default.swe_julday(utc.year, utc.month, utc.day, fractionalHour, swisseph_1.default.SE_GREG_CAL);
    console.log(`Swiss Ephemeris: ${payload.birthDate} ${payload.birthTime} ${payload.timezone} -> JD ${jd}`);
    return jd;
};
// ═══════════════════════════════════════════════════════════════════════════
// VIMSHOTTARI DASHA (pure - no Swiss Ephemeris calls needed)
// ═══════════════════════════════════════════════════════════════════════════
const DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS = {
    Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
function calculateVimshottariDasha(moonSidLon, birthDate, birthTime, timezone) {
    const NAK_LEN = 360 / 27;
    const nakIdx = Math.floor((moonSidLon % 360) / NAK_LEN) % 27;
    const progressInNak = ((moonSidLon % 360) % NAK_LEN) / NAK_LEN; // 0-1, fraction elapsed
    const lordIdx = nakIdx % 9;
    const firstLord = DASHA_LORDS[lordIdx];
    const firstPeriodYears = DASHA_YEARS[firstLord];
    const remainingYears = (1 - progressInNak) * firstPeriodYears;
    const birthDt = luxon_1.DateTime.fromISO(`${birthDate}T${birthTime}`, { zone: timezone });
    const now = luxon_1.DateTime.utc();
    // Build all 9 mahadashas
    const allMahadashas = [];
    let cursor = birthDt;
    const firstEnd = birthDt.plus({ years: remainingYears });
    allMahadashas.push({
        lord: firstLord,
        years: firstPeriodYears,
        startDate: birthDt.toISODate(),
        endDate: firstEnd.toISODate(),
        isCurrent: now >= birthDt && now < firstEnd,
    });
    cursor = firstEnd;
    for (let i = 1; i <= 8; i++) {
        const lord = DASHA_LORDS[(lordIdx + i) % 9];
        const years = DASHA_YEARS[lord];
        const end = cursor.plus({ years });
        allMahadashas.push({
            lord,
            years,
            startDate: cursor.toISODate(),
            endDate: end.toISODate(),
            isCurrent: now >= cursor && now < end,
        });
        cursor = end;
    }
    const mahadasha = (allMahadashas.find(d => d.isCurrent) ?? allMahadashas[allMahadashas.length - 1]);
    // Antardasha within current mahadasha
    const mahaStart = luxon_1.DateTime.fromISO(mahadasha.startDate);
    const mahaEnd = luxon_1.DateTime.fromISO(mahadasha.endDate);
    const mahaYears = mahaEnd.diff(mahaStart, 'years').years;
    const currentLordIdx = DASHA_LORDS.indexOf(mahadasha.lord);
    let antCursor = mahaStart;
    const antardashas = [];
    for (let i = 0; i < 9; i++) {
        const antLord = DASHA_LORDS[(currentLordIdx + i) % 9];
        const antYears = (DASHA_YEARS[antLord] / 120) * mahaYears;
        const antEnd = antCursor.plus({ years: antYears });
        antardashas.push({
            lord: antLord,
            startDate: antCursor.toISODate(),
            endDate: antEnd.toISODate(),
            isCurrent: now >= antCursor && now < antEnd,
        });
        antCursor = antEnd;
    }
    const antardasha = (antardashas.find(d => d.isCurrent) ?? antardashas[antardashas.length - 1]);
    return { mahadasha, antardasha, allMahadashas };
}
// ═══════════════════════════════════════════════════════════════════════════
// NAVAMSHA D-9 (pure - derived from sidereal longitudes)
// ═══════════════════════════════════════════════════════════════════════════
// Element start signs: fire→Aries(0), earth→Capricorn(9), air→Libra(6), water→Cancer(3)
const NAVAMSHA_STARTS = [0, 9, 6, 3];
function calculateNavamshaSign(siderealLongitude) {
    const signIdx = Math.floor((siderealLongitude % 360) / 30) % 12;
    const degInSign = (siderealLongitude % 360) % 30;
    const navamshaDiv = Math.floor(degInSign / (30 / 9)); // 0-8
    const start = NAVAMSHA_STARTS[signIdx % 4];
    const navamshaSignIdx = (start + navamshaDiv) % 12;
    return SIGNS[navamshaSignIdx] ?? 'Unknown';
}
class SwissEphemerisEngine {
    /**
     * Compute Sun, Moon, and Rising signs using Swiss Ephemeris
     * This is the ONLY accurate method - LLMs must NEVER calculate these!
     */
    async computePlacements(payload) {
        const jdUt = toJulianDay(payload);
        // Calculate Sun position
        const sun = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_SUN, flags);
        if ('error' in sun) {
            throw new Error(`Swiss Ephemeris Sun calculation failed: ${sun.error}`);
        }
        const sunLongitude = sun.longitude;
        // Calculate Moon position
        const moon = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MOON, flags);
        if ('error' in moon) {
            throw new Error(`Swiss Ephemeris Moon calculation failed: ${moon.error}`);
        }
        const moonLongitude = moon.longitude;
        // Calculate all planetary positions (tropical) for Human Design & Gene Keys
        const mercury = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MERCURY, flags);
        if ('error' in mercury) {
            throw new Error(`Swiss Ephemeris Mercury calculation failed: ${mercury.error}`);
        }
        const mercuryLongitude = mercury.longitude;
        const venus = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_VENUS, flags);
        if ('error' in venus) {
            throw new Error(`Swiss Ephemeris Venus calculation failed: ${venus.error}`);
        }
        const venusLongitude = venus.longitude;
        const mars = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MARS, flags);
        if ('error' in mars) {
            throw new Error(`Swiss Ephemeris Mars calculation failed: ${mars.error}`);
        }
        const marsLongitude = mars.longitude;
        const jupiter = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_JUPITER, flags);
        if ('error' in jupiter) {
            throw new Error(`Swiss Ephemeris Jupiter calculation failed: ${jupiter.error}`);
        }
        const jupiterLongitude = jupiter.longitude;
        const saturn = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_SATURN, flags);
        if ('error' in saturn) {
            throw new Error(`Swiss Ephemeris Saturn calculation failed: ${saturn.error}`);
        }
        const saturnLongitude = saturn.longitude;
        const uranus = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_URANUS, flags);
        if ('error' in uranus) {
            throw new Error(`Swiss Ephemeris Uranus calculation failed: ${uranus.error}`);
        }
        const uranusLongitude = uranus.longitude;
        const neptune = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_NEPTUNE, flags);
        if ('error' in neptune) {
            throw new Error(`Swiss Ephemeris Neptune calculation failed: ${neptune.error}`);
        }
        const neptuneLongitude = neptune.longitude;
        const pluto = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_PLUTO, flags);
        if ('error' in pluto) {
            throw new Error(`Swiss Ephemeris Pluto calculation failed: ${pluto.error}`);
        }
        const plutoLongitude = pluto.longitude;
        // Mean node (North Node) - tropical
        const meanNode = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MEAN_NODE, flags);
        if ('error' in meanNode) {
            throw new Error(`Swiss Ephemeris Mean Node calculation failed: ${meanNode.error}`);
        }
        const northNodeLongitude = meanNode.longitude;
        const northNodeLongitudeSpeed = meanNode.longitudeSpeed;
        const southNodeLongitude = (northNodeLongitude + 180) % 360;
        // Calculate Houses (Ascendant/Rising + House Cusps) - Tropical Western
        const houses = swisseph_1.default.swe_houses(jdUt, payload.latitude, payload.longitude, 'P'); // Placidus
        if ('error' in houses) {
            throw new Error(`Swiss Ephemeris Houses calculation failed: ${houses.error}`);
        }
        const ascendant = houses.ascendant;
        const mcLongitude = houses.mc;
        const houseCusps = houses.house; // length 12, index 0 = house 1 cusp
        // Calculate exact degrees with decans
        const sunDeg = toDegrees(sunLongitude);
        const moonDeg = toDegrees(moonLongitude);
        const ascDeg = toDegrees(ascendant);
        // Calculate which houses Sun and Moon are in
        const sunHouse = getHouse(sunLongitude, houseCusps);
        const moonHouse = getHouse(moonLongitude, houseCusps);
        // Houses for other planets (tropical)
        const mercuryHouse = getHouse(mercuryLongitude, houseCusps);
        const venusHouse = getHouse(venusLongitude, houseCusps);
        const marsHouse = getHouse(marsLongitude, houseCusps);
        const jupiterHouse = getHouse(jupiterLongitude, houseCusps);
        const saturnHouse = getHouse(saturnLongitude, houseCusps);
        const uranusHouse = getHouse(uranusLongitude, houseCusps);
        const neptuneHouse = getHouse(neptuneLongitude, houseCusps);
        const plutoHouse = getHouse(plutoLongitude, houseCusps);
        const northNodeHouse = getHouse(northNodeLongitude, houseCusps);
        const southNodeHouse = getHouse(southNodeLongitude, houseCusps);
        const northNodeDeg = toDegrees(northNodeLongitude);
        const southNodeDeg = toDegrees(southNodeLongitude);
        const planets = [
            {
                key: 'sun',
                longitude: normalizeLongitude(sunLongitude),
                longitudeSpeed: sun.longitudeSpeed,
                retrograde: Number(sun.longitudeSpeed) < 0,
                ...sunDeg,
                house: sunHouse,
            },
            {
                key: 'moon',
                longitude: normalizeLongitude(moonLongitude),
                longitudeSpeed: moon.longitudeSpeed,
                retrograde: Number(moon.longitudeSpeed) < 0,
                ...moonDeg,
                house: moonHouse,
            },
            {
                key: 'mercury',
                longitude: normalizeLongitude(mercuryLongitude),
                longitudeSpeed: mercury.longitudeSpeed,
                retrograde: Number(mercury.longitudeSpeed) < 0,
                ...toDegrees(mercuryLongitude),
                house: mercuryHouse,
            },
            {
                key: 'venus',
                longitude: normalizeLongitude(venusLongitude),
                longitudeSpeed: venus.longitudeSpeed,
                retrograde: Number(venus.longitudeSpeed) < 0,
                ...toDegrees(venusLongitude),
                house: venusHouse,
            },
            {
                key: 'mars',
                longitude: normalizeLongitude(marsLongitude),
                longitudeSpeed: mars.longitudeSpeed,
                retrograde: Number(mars.longitudeSpeed) < 0,
                ...toDegrees(marsLongitude),
                house: marsHouse,
            },
            {
                key: 'jupiter',
                longitude: normalizeLongitude(jupiterLongitude),
                longitudeSpeed: jupiter.longitudeSpeed,
                retrograde: Number(jupiter.longitudeSpeed) < 0,
                ...toDegrees(jupiterLongitude),
                house: jupiterHouse,
            },
            {
                key: 'saturn',
                longitude: normalizeLongitude(saturnLongitude),
                longitudeSpeed: saturn.longitudeSpeed,
                retrograde: Number(saturn.longitudeSpeed) < 0,
                ...toDegrees(saturnLongitude),
                house: saturnHouse,
            },
            {
                key: 'uranus',
                longitude: normalizeLongitude(uranusLongitude),
                longitudeSpeed: uranus.longitudeSpeed,
                retrograde: Number(uranus.longitudeSpeed) < 0,
                ...toDegrees(uranusLongitude),
                house: uranusHouse,
            },
            {
                key: 'neptune',
                longitude: normalizeLongitude(neptuneLongitude),
                longitudeSpeed: neptune.longitudeSpeed,
                retrograde: Number(neptune.longitudeSpeed) < 0,
                ...toDegrees(neptuneLongitude),
                house: neptuneHouse,
            },
            {
                key: 'pluto',
                longitude: normalizeLongitude(plutoLongitude),
                longitudeSpeed: pluto.longitudeSpeed,
                retrograde: Number(pluto.longitudeSpeed) < 0,
                ...toDegrees(plutoLongitude),
                house: plutoHouse,
            },
        ];
        const natalAspectPoints = [
            ...planets.map((p) => ({ name: p.key.toUpperCase(), longitude: p.longitude })),
            { name: 'ASC', longitude: normalizeLongitude(ascendant) },
            { name: 'MC', longitude: normalizeLongitude(mcLongitude) },
            { name: 'NORTH_NODE', longitude: normalizeLongitude(northNodeLongitude) },
            { name: 'SOUTH_NODE', longitude: normalizeLongitude(southNodeLongitude) },
        ];
        const aspects = computeMajorAspects(natalAspectPoints, 5);
        // Current transits (UTC "now") for timing layer: Sun through Pluto aspects to natal planets + angles.
        const nowUtc = luxon_1.DateTime.utc();
        const nowFractionalHour = nowUtc.hour + nowUtc.minute / 60 + nowUtc.second / 3600;
        const jdNow = swisseph_1.default.swe_julday(nowUtc.year, nowUtc.month, nowUtc.day, nowFractionalHour, swisseph_1.default.SE_GREG_CAL);
        const calcTransit = (key, planet) => {
            const res = swisseph_1.default.swe_calc_ut(jdNow, planet, flags);
            if ('error' in res) {
                throw new Error(`Swiss Ephemeris transit calculation failed for ${key}: ${res.error}`);
            }
            const lon = res.longitude;
            const speed = res.longitudeSpeed;
            const d = toDegrees(lon);
            return {
                key,
                longitude: normalizeLongitude(lon),
                longitudeSpeed: speed,
                retrograde: Number(speed) < 0,
                ...d,
                house: getHouse(lon, houseCusps),
            };
        };
        const transitPlanets = [
            calcTransit('sun', swisseph_1.default.SE_SUN),
            calcTransit('moon', swisseph_1.default.SE_MOON),
            calcTransit('mercury', swisseph_1.default.SE_MERCURY),
            calcTransit('venus', swisseph_1.default.SE_VENUS),
            calcTransit('mars', swisseph_1.default.SE_MARS),
            calcTransit('jupiter', swisseph_1.default.SE_JUPITER),
            calcTransit('saturn', swisseph_1.default.SE_SATURN),
            calcTransit('uranus', swisseph_1.default.SE_URANUS),
            calcTransit('neptune', swisseph_1.default.SE_NEPTUNE),
            calcTransit('pluto', swisseph_1.default.SE_PLUTO),
        ];
        const natalForTransit = [
            ...planets.map((p) => ({ name: p.key.toUpperCase(), longitude: p.longitude })),
            { name: 'ASC', longitude: normalizeLongitude(ascendant) },
            { name: 'MC', longitude: normalizeLongitude(mcLongitude) },
        ];
        const transitAspects = [];
        for (const tp of transitPlanets) {
            const points = [{ name: `T_${tp.key.toUpperCase()}`, longitude: tp.longitude }, ...natalForTransit];
            const found = computeMajorAspects(points, 5)
                .filter((a) => a.a === `T_${tp.key.toUpperCase()}`)
                .map((a) => ({
                transit: a.a,
                natal: a.b,
                type: a.type,
                orb: a.orb,
                exact: a.exact,
            }));
            transitAspects.push(...found);
        }
        const result = {
            sunSign: toSign(sunLongitude),
            moonSign: toSign(moonLongitude),
            risingSign: toSign(ascendant),
            sunLongitude: normalizeLongitude(sunLongitude),
            moonLongitude: normalizeLongitude(moonLongitude),
            ascendantLongitude: normalizeLongitude(ascendant),
            sunDegree: {
                ...sunDeg,
                decan: getDecan(sunDeg.degree),
            },
            moonDegree: {
                ...moonDeg,
                decan: getDecan(moonDeg.degree),
            },
            ascendantDegree: {
                ...ascDeg,
                decan: getDecan(ascDeg.degree),
            },
            sunHouse,
            moonHouse,
            tropical: {
                houseSystem: 'Placidus',
                houseCusps: (houseCusps || []).map((c) => normalizeLongitude(c)),
                mcLongitude: normalizeLongitude(mcLongitude),
                planets,
                nodes: {
                    northNodeLongitude: normalizeLongitude(northNodeLongitude),
                    southNodeLongitude: normalizeLongitude(southNodeLongitude),
                    northNodeHouse,
                    southNodeHouse,
                    northNodeDegree: northNodeDeg,
                    southNodeDegree: southNodeDeg,
                    northNodeRetrograde: Number(northNodeLongitudeSpeed) < 0,
                    southNodeRetrograde: Number(northNodeLongitudeSpeed) < 0, // same speed sign, opposite longitude
                },
                aspects,
                transits: {
                    calculatedAt: nowUtc.toISO() || new Date().toISOString(),
                    planets: transitPlanets,
                    aspectsToNatal: transitAspects.sort((a, b) => a.orb - b.orb),
                },
            },
        };
        // Kabbalah V2 structure profile (Tree-of-Life, Tikkun, Klipoth, Four Worlds)
        // Computed here (async stage) so chartDataBuilder can remain a pure sync function.
        try {
            const birthDt = luxon_1.DateTime.fromISO(`${payload.birthDate}T${payload.birthTime}`, { zone: payload.timezone });
            const hebrewDate = await HebrewCalendarService_1.hebrewCalendarService.getHebrewDate(birthDt.toJSDate(), payload.timezone);
            result.kabbalahProfile = (0, KabbalahCalculatorV2_1.calculateKabbalahProfileV2)(result, hebrewDate);
        }
        catch (e) {
            console.warn('[Swiss Ephemeris] Kabbalah profile calculation failed:', e);
        }
        // Sidereal (Vedic) extras: compute sidereal longitudes + sidereal houses/ascendant.
        // NOTE: We keep these attached so the LLM never "guesses" sidereal math.
        try {
            console.log(`[Swiss Ephemeris] Starting sidereal computation for JD ${jdUt}...`);
            // Ensure Lahiri ayanamsha is active
            ensureSiderealMode();
            const ayanamsaUt = swisseph_1.default.swe_get_ayanamsa_ut(jdUt);
            console.log(`[Swiss Ephemeris] Current Ayanamsa: ${ayanamsaUt}°`);
            const ayanamsaName = swisseph_1.default.swe_get_ayanamsa_name(swisseph_1.default.SE_SIDM_LAHIRI);
            const sunSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_SUN, siderealFlags);
            if ('error' in sunSid)
                throw new Error(`Sun Sidereal: ${sunSid.error}`);
            const moonSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MOON, siderealFlags);
            if ('error' in moonSid)
                throw new Error(`Moon Sidereal: ${moonSid.error}`);
            const rahuSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MEAN_NODE, siderealFlags);
            if ('error' in rahuSid)
                throw new Error(`Rahu Sidereal: ${rahuSid.error}`);
            const rahuTrueSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_TRUE_NODE, siderealFlags);
            if ('error' in rahuTrueSid)
                throw new Error(`Rahu True Sidereal: ${rahuTrueSid.error}`);
            const mercurySid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MERCURY, siderealFlags);
            if ('error' in mercurySid)
                throw new Error(`Mercury Sidereal: ${mercurySid.error}`);
            const venusSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_VENUS, siderealFlags);
            if ('error' in venusSid)
                throw new Error(`Venus Sidereal: ${venusSid.error}`);
            const marsSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_MARS, siderealFlags);
            if ('error' in marsSid)
                throw new Error(`Mars Sidereal: ${marsSid.error}`);
            const jupiterSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_JUPITER, siderealFlags);
            if ('error' in jupiterSid)
                throw new Error(`Jupiter Sidereal: ${jupiterSid.error}`);
            const saturnSid = swisseph_1.default.swe_calc_ut(jdUt, swisseph_1.default.SE_SATURN, siderealFlags);
            if ('error' in saturnSid)
                throw new Error(`Saturn Sidereal: ${saturnSid.error}`);
            // Vedic charts are commonly presented as whole-sign houses (Rashi chart).
            // Using swe_houses_ex with SEFLG_SIDEREAL returns a sidereal ascendant longitude.
            const housesSid = swisseph_1.default.swe_houses_ex(jdUt, siderealFlags, payload.latitude, payload.longitude, 'W');
            if ('error' in housesSid) {
                console.warn(`[Swiss Ephemeris] Sidereal houses failed, falling back to Tropical - Ayanamsa math: ${housesSid.error}`);
                // Manual fallback for houses if swe_houses_ex fails with sidereal flag
                const housesTrop = swisseph_1.default.swe_houses(jdUt, payload.latitude, payload.longitude, 'W');
                if ('error' in housesTrop)
                    throw new Error(`House calculation failed: ${housesTrop.error}`);
                // Manual sidereal adjustment
                housesSid.ascendant = (housesTrop.ascendant - ayanamsaUt + 360) % 360;
                housesSid.house = housesTrop.house.map(h => (h - ayanamsaUt + 360) % 360);
            }
            const sunSidLon = (sunSid.longitude % 360 + 360) % 360;
            const moonSidLon = (moonSid.longitude % 360 + 360) % 360;
            const ascSidLon = (housesSid.ascendant % 360 + 360) % 360;
            const rahuSidLon = (rahuSid.longitude % 360 + 360) % 360;
            const ketuSidLon = (rahuSidLon + 180) % 360;
            const rahuTrueSidLon = (rahuTrueSid.longitude % 360 + 360) % 360;
            const ketuTrueSidLon = (rahuTrueSidLon + 180) % 360;
            const mercurySidLon = (mercurySid.longitude % 360 + 360) % 360;
            const venusSidLon = (venusSid.longitude % 360 + 360) % 360;
            const marsSidLon = (marsSid.longitude % 360 + 360) % 360;
            const jupiterSidLon = (jupiterSid.longitude % 360 + 360) % 360;
            const saturnSidLon = (saturnSid.longitude % 360 + 360) % 360;
            console.log(`[Swiss Ephemeris] Sidereal positions calculated: Lagna=${toSign(ascSidLon)} ${ascSidLon % 30}°, Sun=${toSign(sunSidLon)} ${sunSidLon % 30}°`);
            // Nakshatra math: 27 nakshatras × 13°20' each; 4 padas × 3°20' each.
            const NAK_LEN = 360 / 27; // 13.3333333333...
            const PADA_LEN = NAK_LEN / 4; // 3.3333333333...
            const nakshatras = [
                'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
                'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
                'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
                'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha',
                'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
            ];
            const nakIdx = Math.floor(moonSidLon / NAK_LEN) % 27;
            const janmaNakshatra = nakshatras[nakIdx] || 'Unknown';
            const pada = (Math.floor((moonSidLon % NAK_LEN) / PADA_LEN) + 1);
            const lagnaSignIndex = toSignIndex(ascSidLon);
            const wholeSignBhava = (planetLon) => ((toSignIndex(planetLon) - lagnaSignIndex + 12) % 12) + 1;
            const toGraha = (key, lon, extra) => {
                const d = toDegrees(lon);
                return {
                    key,
                    longitude: lon,
                    sign: d.sign,
                    degree: d.degree,
                    minute: d.minute,
                    bhava: wholeSignBhava(lon),
                    ...extra,
                };
            };
            result.ayanamsaUt = ayanamsaUt;
            result.sidereal = {
                ayanamsaName,
                sunLongitude: sunSidLon,
                moonLongitude: moonSidLon,
                ascendantLongitude: ascSidLon,
                rahuLongitude: rahuSidLon,
                ketuLongitude: ketuSidLon,
                rahuTrueLongitude: rahuTrueSidLon,
                ketuTrueLongitude: ketuTrueSidLon,
                lagnaSign: toSign(ascSidLon),
                chandraRashi: toSign(moonSidLon),
                suryaRashi: toSign(sunSidLon),
                janmaNakshatra,
                janmaPada: pada,
                grahas: [
                    toGraha('sun', sunSidLon),
                    toGraha('moon', moonSidLon, { nakshatra: janmaNakshatra, pada }),
                    toGraha('mars', marsSidLon),
                    toGraha('mercury', mercurySidLon),
                    toGraha('jupiter', jupiterSidLon),
                    toGraha('venus', venusSidLon),
                    toGraha('saturn', saturnSidLon),
                    toGraha('rahu', rahuSidLon),
                    toGraha('ketu', ketuSidLon),
                    // True node variants are included for Kundli-style configurability
                    // (some apps let users choose True vs Mean Rahu). We keep them separate.
                    toGraha('rahu', rahuTrueSidLon, { isTrueNode: true }),
                    toGraha('ketu', ketuTrueSidLon, { isTrueNode: true }),
                ],
            };
            // Vimshottari Dasha
            try {
                result.vimshottariDasha = calculateVimshottariDasha(moonSidLon, payload.birthDate, payload.birthTime, payload.timezone);
                console.log(`[Swiss Ephemeris] Dasha: ${result.vimshottariDasha.mahadasha.lord} / ${result.vimshottariDasha.antardasha.lord}`);
            }
            catch (e) {
                console.warn('[Swiss Ephemeris] Vimshottari Dasha calculation failed:', e);
            }
            // Navamsha (D-9)
            try {
                const grahasForNavamsha = (result.sidereal?.grahas || []).filter((g) => !g.isTrueNode);
                result.navamsha = {
                    lagnaSign: calculateNavamshaSign(ascSidLon),
                    grahas: grahasForNavamsha.map((g) => ({
                        key: g.key,
                        navamshaSign: calculateNavamshaSign(g.longitude),
                    })),
                };
                console.log(`[Swiss Ephemeris] Navamsha Lagna: ${result.navamsha.lagnaSign}`);
            }
            catch (e) {
                console.warn('[Swiss Ephemeris] Navamsha calculation failed:', e);
            }
        }
        catch (e) {
            console.warn('[Swiss Ephemeris] Sidereal computation failed:', e);
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // HUMAN DESIGN & GENE KEYS CALCULATION
        // Using hdkit algorithm: https://github.com/jdempcy/hdkit
        // ═══════════════════════════════════════════════════════════════════════════
        try {
            console.log('[Swiss Ephemeris] Calculating Human Design & Gene Keys...');
            // 1. Calculate Design date using hdkit's binary search algorithm
            // Human Design uses the moment when Sun was EXACTLY 88° behind birth Sun position
            // This is NOT simply 88 days - the Sun's speed varies throughout the year
            // hdkit searches between 84-96 days before birth with high precision
            const birthSunDegrees = sunLongitude;
            let startJd = jdUt - 96; // 96 days before birth
            let endJd = jdUt - 84; // 84 days before birth
            let designJdUt = jdUt - 88; // Initial estimate
            const MAX_ITERATIONS = 100;
            const TOLERANCE = 0.00001; // ~0.036 arc seconds precision (hdkit uses 0.00001)
            for (let i = 0; i < MAX_ITERATIONS; i++) {
                const midJd = (startJd + endJd) / 2;
                const midSunResult = swisseph_1.default.swe_calc_ut(midJd, swisseph_1.default.SE_SUN, flags);
                if ('error' in midSunResult)
                    break;
                const midSunDegrees = midSunResult.longitude;
                let difference = Math.abs(birthSunDegrees - midSunDegrees);
                if (difference > 180)
                    difference = 360 - difference;
                if (difference < 88 + TOLERANCE && difference > 88 - TOLERANCE) {
                    // Found the design date with required precision
                    designJdUt = midJd;
                    break;
                }
                else if (difference > 88) {
                    // Sun is more than 88° away, need to move closer to birth
                    startJd = midJd;
                }
                else {
                    // Sun is less than 88° away, need to move further from birth
                    endJd = midJd;
                }
                designJdUt = midJd;
            }
            const daysBeforeBirth = jdUt - designJdUt;
            console.log(`[Swiss Ephemeris] Design date: ${daysBeforeBirth.toFixed(2)} days before birth (88° Sun offset)`);
            // 2. Calculate planetary positions for Design time
            const getDesignPosition = (planet) => {
                const result = swisseph_1.default.swe_calc_ut(designJdUt, planet, flags);
                if ('error' in result) {
                    throw new Error(`Failed to calculate design position for planet ${planet}: ${result.error}`);
                }
                return result.longitude;
            };
            const getPersonalityPosition = (planet) => {
                const result = swisseph_1.default.swe_calc_ut(jdUt, planet, flags);
                if ('error' in result) {
                    throw new Error(`Failed to calculate personality position for planet ${planet}: ${result.error}`);
                }
                return result.longitude;
            };
            // 3. Build PlanetaryPositions object (personality + design)
            const planetaryPositions = {
                personality: {
                    sun: sunLongitude,
                    earth: (sunLongitude + 180) % 360,
                    moon: moonLongitude,
                    northNode: getPersonalityPosition(swisseph_1.default.SE_MEAN_NODE),
                    southNode: (getPersonalityPosition(swisseph_1.default.SE_MEAN_NODE) + 180) % 360,
                    mercury: mercuryLongitude,
                    venus: venusLongitude,
                    mars: marsLongitude,
                    jupiter: jupiterLongitude,
                    saturn: saturnLongitude,
                    uranus: uranusLongitude,
                    neptune: neptuneLongitude,
                    pluto: plutoLongitude,
                },
                design: {
                    sun: getDesignPosition(swisseph_1.default.SE_SUN),
                    earth: (getDesignPosition(swisseph_1.default.SE_SUN) + 180) % 360,
                    moon: getDesignPosition(swisseph_1.default.SE_MOON),
                    northNode: getDesignPosition(swisseph_1.default.SE_MEAN_NODE),
                    southNode: (getDesignPosition(swisseph_1.default.SE_MEAN_NODE) + 180) % 360,
                    mercury: getDesignPosition(swisseph_1.default.SE_MERCURY),
                    venus: getDesignPosition(swisseph_1.default.SE_VENUS),
                    mars: getDesignPosition(swisseph_1.default.SE_MARS),
                    jupiter: getDesignPosition(swisseph_1.default.SE_JUPITER),
                    saturn: getDesignPosition(swisseph_1.default.SE_SATURN),
                    uranus: getDesignPosition(swisseph_1.default.SE_URANUS),
                    neptune: getDesignPosition(swisseph_1.default.SE_NEPTUNE),
                    pluto: getDesignPosition(swisseph_1.default.SE_PLUTO),
                },
            };
            // 4. Calculate Human Design
            const hdResult = (0, humanDesignCalculator_1.calculateHumanDesign)(planetaryPositions);
            console.log(`[Swiss Ephemeris] Human Design Type: ${hdResult.type}, Profile: ${hdResult.profile}`);
            // 5. Calculate Gene Keys
            const gkResult = (0, geneKeysCalculator_1.calculateGeneKeys)(planetaryPositions);
            console.log(`[Swiss Ephemeris] Gene Keys Life's Work: ${gkResult.lifesWork?.geneKey}.${gkResult.lifesWork?.line}`);
            // 6. Add to result
            result.humanDesign = {
                type: hdResult.type,
                strategy: hdResult.strategy,
                authority: hdResult.authority,
                profile: hdResult.profile,
                incarnationCross: hdResult.incarnationCross,
                definedCenters: hdResult.definedCenters,
                activeGates: hdResult.activeGates,
                activeChannels: hdResult.activeChannels,
                personality: hdResult.personality,
                design: hdResult.design,
            };
            result.geneKeys = gkResult;
        }
        catch (e) {
            console.error('[Swiss Ephemeris] Human Design & Gene Keys calculation failed:', e);
            // Don't fail the entire request - just log the error
        }
        console.log(`Swiss Ephemeris Results:`, JSON.stringify(result, null, 2));
        return result;
    }
    /**
     * Verify the ephemeris files are loaded correctly
     */
    async healthCheck() {
        try {
            // Test calculation for a known date
            const testResult = await this.computePlacements({
                birthDate: '2000-01-01',
                birthTime: '12:00',
                timezone: 'UTC',
                latitude: 0,
                longitude: 0,
                relationshipIntensity: 5,
                relationshipMode: 'sensual',
                primaryLanguage: 'en',
            });
            if (testResult.sunSign === 'Capricorn') {
                return { status: 'ok', message: `Ephemeris loaded from: ${ephePath}` };
            }
            return { status: 'error', message: 'Unexpected test result' };
        }
        catch (error) {
            return { status: 'error', message: String(error) };
        }
    }
}
exports.SwissEphemerisEngine = SwissEphemerisEngine;
exports.swissEngine = new SwissEphemerisEngine();
//# sourceMappingURL=swissEphemeris.js.map