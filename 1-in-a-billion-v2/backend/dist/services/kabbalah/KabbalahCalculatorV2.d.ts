/**
 * KABBALISTIC ASTROLOGY CALCULATOR (V2)
 *
 * Purpose:
 * - Map Swiss Ephemeris tropical placements onto a Kabbalistic Tree-of-Life structure.
 * - Produce deterministic, specific "structure data" so the LLM cannot drift into generic mysticism.
 *
 * Notes:
 * - NO name-based gematria. No Hebrew transliteration of names.
 * - Uses a Sefer Yetzirah style mapping:
 *   - 7 double letters -> 7 classical planets -> lower sefirot
 *   - 12 simple letters -> zodiac signs (for the Sun/Moon/Rising letter triad + faculties)
 *   - elements -> Four Worlds balance
 */
import type { PlacementSummary } from '../swissEphemeris';
import type { HebrewDateInfo } from './HebrewCalendarService';
export interface KabbalahAspect {
    planet1: string;
    planet2: string;
    type: 'conjunction' | 'opposition' | 'square' | 'trine' | 'sextile';
    orb: number;
    isHard: boolean;
}
export interface KabbalahProfileV2 {
    sefiroticProfile: {
        dominant: Array<{
            sefirah: string;
            planet: string;
            sign: string;
            house?: number;
            strength: 'strong' | 'moderate' | 'weak';
            hebrewLetter: string;
            duality: {
                positive: string;
                negative: string;
            };
        }>;
        void: string[];
        balance: {
            pillarOfMercy: number;
            pillarOfSeverity: number;
            middlePillar: number;
            upperTree: number;
            lowerTree: number;
            heartCenter: number;
        };
    };
    letterSignature: {
        sunLetter: {
            letter: string;
            name: string;
            faculty: string;
        };
        moonLetter: {
            letter: string;
            name: string;
            faculty: string;
        };
        risingLetter: {
            letter: string;
            name: string;
            faculty: string;
        };
        allActiveLetters: Array<{
            letter: string;
            name: string;
            planet: string;
            type: 'double' | 'simple';
        }>;
    };
    fourWorlds: {
        atziluth: {
            count: number;
            percentage: number;
            element: 'Fire';
            planets: string[];
        };
        beriah: {
            count: number;
            percentage: number;
            element: 'Water';
            planets: string[];
        };
        yetzirah: {
            count: number;
            percentage: number;
            element: 'Air';
            planets: string[];
        };
        assiyah: {
            count: number;
            percentage: number;
            element: 'Earth';
            planets: string[];
        };
        dominant: string;
        void: string[];
    };
    tikkun: {
        hebrewBirthMonth: string;
        tikkunName: string;
        correction: string;
        trap: string;
        gift: string;
        zodiacSign: string;
        hebrewLetter: string;
        tribe: string;
    };
    klipothicProfile: {
        activeKlipoth: Array<{
            sefirah: string;
            klipahName: string;
            meaning: string;
            shadow: string;
            manifestation: string;
            trigger: string;
        }>;
        hardAspects: KabbalahAspect[];
        primaryShadowAxis: string;
    };
    hebrewDate: HebrewDateInfo;
    modalityBalance: {
        cardinal: number;
        fixed: number;
        mutable: number;
        dominant: string;
    };
}
export declare function calculateKabbalahProfileV2(placements: PlacementSummary, hebrewDate: HebrewDateInfo): KabbalahProfileV2;
//# sourceMappingURL=KabbalahCalculatorV2.d.ts.map