export type Int = number;
export interface PersonVector {
    id: string;
    moon_nakshatra: Int;
    moon_rashi: Int;
    lagna_rashi: Int;
    mars_house: Int;
    gana: Int;
    yoni: Int;
    dasha_lord: Int;
    seventh_house_lord: Int;
}
export declare const YONI_SCORE_MATRIX: Int[][];
export declare function yoni_score(a: Int, b: Int): Int;
export declare const GANA_SCORE_MATRIX: Int[][];
export declare function gana_score(a: Int, b: Int): Int;
export declare const DASHA_FRIENDSHIP: Int[][];
export declare function dasha_score(a: Int, b: Int): Int;
export declare const SEVENTH_HOUSE_SCORE: Int[][];
export declare function seventh_house_score(a: Int, b: Int): Int;
export interface MatchResult {
    pair_id: string;
    yoni: Int;
    gana: Int;
    dasha: Int;
    seventh_house: Int;
    total: Int;
}
export declare function match_pair(a: PersonVector, b: PersonVector): MatchResult;
export declare function batch_match(people: PersonVector[]): MatchResult[];
//# sourceMappingURL=vedic_matchmaking_full.engine.d.ts.map