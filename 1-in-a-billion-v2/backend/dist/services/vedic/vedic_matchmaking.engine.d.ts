/**
 * VEDIC MATCHMAKING ENGINE
 *
 * A pure, deterministic implementation of Vedic matchmaking logic.
 * Implements granular scoring functions exported for batch usage.
 */
import { PersonChart, VedicMatchmakingResult, Nakshatra } from './vedic_matchmaking.types';
type ScorablePerson = {
    moon_sign?: string;
    moon_nakshatra: Nakshatra | string;
    moon_sign_lord?: string;
    nadi?: string;
    yoni?: string;
    gana?: string;
};
export declare function scoreVarna(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreVashya(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreTara(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreYoni(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreGrahaMaitri(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreGana(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreBhakoot(a: ScorablePerson, b: ScorablePerson): number;
export declare function scoreNadi(a: ScorablePerson, b: ScorablePerson): number;
export declare function computeVedicMatch(personA: PersonChart, personB: PersonChart, context?: any): VedicMatchmakingResult;
export {};
//# sourceMappingURL=vedic_matchmaking.engine.d.ts.map