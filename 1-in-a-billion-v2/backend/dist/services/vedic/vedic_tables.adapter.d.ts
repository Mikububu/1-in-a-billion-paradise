import { Nakshatra } from './vedic_matchmaking.types';
export declare const RASHI_NAMES: readonly ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
export declare const NAKSHATRA_NAMES: readonly ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
export declare const PLANET_NAMES: readonly ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
export type RashiName = typeof RASHI_NAMES[number];
export type NakshatraName = typeof NAKSHATRA_NAMES[number];
export type PlanetName = typeof PLANET_NAMES[number];
/**
 * Get Varna score between two moon signs
 */
export declare function getVarnaScore(rashiA: string, rashiB: string): number;
/**
 * Get Vashya score between two moon signs
 */
export declare function getVashyaScore(rashiA: string, rashiB: string): number;
/**
 * Get Tara score between two nakshatras
 */
export declare function getTaraScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number;
/**
 * Get Yoni score between two nakshatras
 */
export declare function getYoniScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number;
/**
 * Get Graha Maitri score between two moon signs
 */
export declare function getGrahaMaitriScore(rashiA: string, rashiB: string): number;
/**
 * Get planet friendship score between two planets
 */
export declare function getPlanetFriendshipScore(planetA: PlanetName, planetB: PlanetName): number;
/**
 * Get ruling planet for a rashi
 */
export declare function getRashiLord(rashi: string): PlanetName | null;
/**
 * Get Gana score between two nakshatras
 */
export declare function getGanaScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number;
/**
 * Get Bhakoot score between two moon signs
 */
export declare function getBhakootScore(rashiA: string, rashiB: string): number;
/**
 * Get Nadi score between two nakshatras
 */
export declare function getNadiScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number;
//# sourceMappingURL=vedic_tables.adapter.d.ts.map