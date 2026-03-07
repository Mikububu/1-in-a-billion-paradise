/**
 * EXAMPLE: Using Vectorized Types
 *
 * This file demonstrates how to use the new vectorized type system
 * for high-performance Vedic matchmaking.
 */
import { VedicPersonVector } from './vedic_ashtakoota.vectorized.types';
import { VedicPerson } from './vedic_matchmaking.types';
/**
 * Convert a string-based VedicPerson to numeric VedicPersonVector
 */
export declare function convertToVector(person: VedicPerson & {
    ascendant: string;
    mars_house: number;
    jupiter_house?: number;
    venus_house?: number;
    saturn_house?: number;
    dasha_lord: string;
    sub_dasha_lord: string;
}): VedicPersonVector;
/**
 * Derive all attributes from just Nakshatra and Rashi indices
 */
export declare function deriveAttributes(nakshatraIndex: number, rashiIndex: number): {
    gana: import("./vedic_ashtakoota.vectorized.types").GanaIndex;
    nadi: import("./vedic_ashtakoota.vectorized.types").NadiIndex;
    yoni: number;
    varna: import("./vedic_ashtakoota.vectorized.types").VarnaIndex;
    moon_lord: import("./vedic_ashtakoota.vectorized.types").DashaLordIndex;
};
/**
 * Prepare batch input for vectorized matching
 */
export declare function prepareBatchInput(sourcePerson: VedicPersonVector, targetPersons: VedicPersonVector[]): {
    source: VedicPersonVector;
    targets: VedicPersonVector[];
};
//# sourceMappingURL=vedic_ashtakoota.vectorized.examples.d.ts.map