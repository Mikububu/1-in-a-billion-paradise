import { ReadingPayload } from '../types';
import { type KabbalahProfileV2 } from './kabbalah/KabbalahCalculatorV2';
export type PlacementSummary = {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunLongitude: number;
    moonLongitude: number;
    ascendantLongitude: number;
    sunDegree?: {
        sign: string;
        degree: number;
        minute: number;
        decan: 1 | 2 | 3;
    };
    moonDegree?: {
        sign: string;
        degree: number;
        minute: number;
        decan: 1 | 2 | 3;
    };
    ascendantDegree?: {
        sign: string;
        degree: number;
        minute: number;
        decan: 1 | 2 | 3;
    };
    sunHouse?: number;
    moonHouse?: number;
    tropical?: {
        houseSystem: 'Placidus';
        houseCusps: number[];
        mcLongitude: number;
        planets: Array<{
            key: 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
            longitude: number;
            longitudeSpeed?: number;
            retrograde?: boolean;
            sign: string;
            degree: number;
            minute: number;
            house?: number;
        }>;
        nodes?: {
            northNodeLongitude: number;
            southNodeLongitude: number;
            northNodeHouse?: number;
            southNodeHouse?: number;
            northNodeDegree: {
                sign: string;
                degree: number;
                minute: number;
            };
            southNodeDegree: {
                sign: string;
                degree: number;
                minute: number;
            };
            northNodeRetrograde?: boolean;
            southNodeRetrograde?: boolean;
        };
        aspects?: Array<{
            a: string;
            b: string;
            type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
            orb: number;
            exact: boolean;
        }>;
        transits?: {
            calculatedAt: string;
            planets: Array<{
                key: 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
                longitude: number;
                longitudeSpeed?: number;
                retrograde?: boolean;
                sign: string;
                degree: number;
                minute: number;
                house?: number;
            }>;
            aspectsToNatal?: Array<{
                transit: string;
                natal: string;
                type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
                orb: number;
                exact: boolean;
            }>;
        };
    };
    ayanamsaUt?: number;
    sidereal?: {
        ayanamsaName: string;
        sunLongitude: number;
        moonLongitude: number;
        ascendantLongitude: number;
        rahuLongitude?: number;
        ketuLongitude?: number;
        rahuTrueLongitude?: number;
        ketuTrueLongitude?: number;
        lagnaSign: string;
        chandraRashi: string;
        suryaRashi: string;
        janmaNakshatra: string;
        janmaPada: 1 | 2 | 3 | 4;
        grahas: Array<{
            key: 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn' | 'rahu' | 'ketu';
            longitude: number;
            sign: string;
            degree: number;
            minute: number;
            bhava: number;
            nakshatra?: string;
            pada?: 1 | 2 | 3 | 4;
            isTrueNode?: boolean;
        }>;
    };
    humanDesign?: {
        type: 'Manifestor' | 'Generator' | 'Manifesting Generator' | 'Projector' | 'Reflector';
        strategy: string;
        authority: string;
        profile: string;
        incarnationCross: string;
        definedCenters: string[];
        activeGates: number[];
        activeChannels: string[];
        personality: any;
        design: any;
    };
    geneKeys?: {
        lifesWork?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        evolution?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        radiance?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        purpose?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        attraction?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        iq?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        eq?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        sq?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        vocation?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        culture?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
        pearl?: {
            geneKey: number;
            line: number;
            shadow: string;
            gift: string;
            siddhi: string;
        };
    };
    kabbalahProfile?: KabbalahProfileV2;
    vimshottariDasha?: {
        mahadasha: {
            lord: string;
            years: number;
            startDate: string;
            endDate: string;
        };
        antardasha: {
            lord: string;
            startDate: string;
            endDate: string;
        };
        allMahadashas: Array<{
            lord: string;
            years: number;
            startDate: string;
            endDate: string;
            isCurrent: boolean;
        }>;
    };
    navamsha?: {
        lagnaSign: string;
        grahas: Array<{
            key: string;
            navamshaSign: string;
        }>;
    };
};
export declare class SwissEphemerisEngine {
    /**
     * Compute Sun, Moon, and Rising signs using Swiss Ephemeris
     * This is the ONLY accurate method - LLMs must NEVER calculate these!
     */
    computePlacements(payload: ReadingPayload): Promise<PlacementSummary>;
    /**
     * Verify the ephemeris files are loaded correctly
     */
    healthCheck(): Promise<{
        status: 'ok' | 'error';
        message: string;
    }>;
}
export declare const swissEngine: SwissEphemerisEngine;
//# sourceMappingURL=swissEphemeris.d.ts.map