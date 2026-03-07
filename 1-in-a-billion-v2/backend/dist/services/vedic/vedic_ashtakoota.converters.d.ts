/**
 * VECTORIZED TYPE CONVERSION UTILITIES
 *
 * Provides bidirectional conversion between string-based and numeric-indexed
 * representations for Vedic matchmaking data.
 *
 * These utilities enable seamless integration between:
 * - User-facing string-based APIs
 * - High-performance vectorized computation engine
 */
import { NakshatraIndex, RashiIndex, GanaIndex, NadiIndex, VarnaIndex, YoniIndex, DashaLordIndex, NakshatraAttributeTable, RashiAttributeTable } from './vedic_ashtakoota.vectorized.types';
import { Nakshatra, Gana, Nadi, Varna } from './vedic_matchmaking.types';
/**
 * Convert Nakshatra name to numeric index (0-26)
 */
export declare function nakshatraToIndex(nakshatra: Nakshatra): NakshatraIndex;
/**
 * Convert numeric index to Nakshatra name
 */
export declare function indexToNakshatra(index: NakshatraIndex): Nakshatra;
/**
 * Convert Rashi name to numeric index (0-11)
 */
export declare function rashiToIndex(rashi: string): RashiIndex;
/**
 * Convert numeric index to Rashi name
 */
export declare function indexToRashi(index: RashiIndex): string;
/**
 * Convert Gana name to numeric index (0-2)
 */
export declare function ganaToIndex(gana: Gana): GanaIndex;
/**
 * Convert numeric index to Gana name
 */
export declare function indexToGana(index: GanaIndex): Gana;
/**
 * Convert Nadi name to numeric index (0-2)
 */
export declare function nadiToIndex(nadi: Nadi): NadiIndex;
/**
 * Convert numeric index to Nadi name
 */
export declare function indexToNadi(index: NadiIndex): Nadi;
/**
 * Convert Varna name to numeric index (0-3)
 */
export declare function varnaToIndex(varna: Varna): VarnaIndex;
/**
 * Convert numeric index to Varna name
 */
export declare function indexToVarna(index: VarnaIndex): Varna;
/**
 * Convert planet name to Dasha lord index (0-8)
 */
export declare function dashaLordToIndex(planet: string): DashaLordIndex;
/**
 * Convert numeric index to Dasha lord name
 */
export declare function indexToDashaLord(index: DashaLordIndex): string;
/**
 * Nakshatra to Gana mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
export declare const NAKSHATRA_GANA_TABLE: GanaIndex[];
/**
 * Nakshatra to Nadi mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
export declare const NAKSHATRA_NADI_TABLE: NadiIndex[];
/**
 * Nakshatra to Yoni mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 * Yoni indices: 0=Horse, 1=Elephant, 2=Sheep, 3=Serpent, 4=Dog, 5=Cat, 6=Rat,
 *               7=Cow, 8=Buffalo, 9=Tiger, 10=Deer, 11=Monkey, 12=Mongoose, 13=Lion
 */
export declare const NAKSHATRA_YONI_TABLE: YoniIndex[];
/**
 * Complete Nakshatra attribute table
 */
export declare const NAKSHATRA_ATTRIBUTES: NakshatraAttributeTable;
/**
 * Rashi to Varna mapping (12 entries)
 * Source: VECTORIZED_BATCH_MATCHER.md
 */
export declare const RASHI_VARNA_TABLE: VarnaIndex[];
/**
 * Rashi to ruling planet (lord) mapping (12 entries)
 * 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
 */
export declare const RASHI_LORD_TABLE: DashaLordIndex[];
/**
 * Complete Rashi attribute table
 */
export declare const RASHI_ATTRIBUTES: RashiAttributeTable;
/**
 * Get Gana from Nakshatra index
 */
export declare function getGanaFromNakshatra(nakshatraIndex: NakshatraIndex): GanaIndex;
/**
 * Get Nadi from Nakshatra index
 */
export declare function getNadiFromNakshatra(nakshatraIndex: NakshatraIndex): NadiIndex;
/**
 * Get Yoni from Nakshatra index
 */
export declare function getYoniFromNakshatra(nakshatraIndex: NakshatraIndex): YoniIndex;
/**
 * Get Varna from Rashi index
 */
export declare function getVarnaFromRashi(rashiIndex: RashiIndex): VarnaIndex;
/**
 * Get ruling planet from Rashi index
 */
export declare function getLordFromRashi(rashiIndex: RashiIndex): DashaLordIndex;
//# sourceMappingURL=vedic_ashtakoota.converters.d.ts.map