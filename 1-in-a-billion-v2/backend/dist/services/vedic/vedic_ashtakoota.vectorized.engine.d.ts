export type Gender = 0 | 1;
export type RashiIndex = number;
export type NakshatraIndex = number;
export type GanaIndex = 0 | 1 | 2;
export type YoniIndex = number;
export type PlanetIndex = number;
export type HouseIndex = number;
export interface VedicPersonVector {
    gender: Gender;
    moon_rashi: RashiIndex;
    moon_nakshatra: NakshatraIndex;
    gana: GanaIndex;
    yoni: YoniIndex;
    mars_house: HouseIndex;
    mars_rashi?: RashiIndex;
    seventh_house_ruler: PlanetIndex;
    dasha_lord: PlanetIndex;
    mahadasha_index: number;
}
export type ManglikStatus = "none" | "active" | "cancelled";
export interface DoshaResult {
    manglik: ManglikStatus;
    nadi: boolean;
    bhakoot: boolean;
}
export interface DashaSyncResult {
    alignment_score: number;
    phase_relation: "same" | "supportive" | "conflicting";
}
export interface VedicMatchResult {
    guna_total: number;
    guna_breakdown: {
        varna: number;
        vashya: number;
        tara: number;
        yoni: number;
        graha_maitri: number;
        gana: number;
        bhakoot: number;
        nadi: number;
    };
    dosha: DoshaResult;
    dasha: DashaSyncResult;
    verdict_band: "reject" | "average" | "good" | "excellent";
}
export declare function matchVedicPair(a: VedicPersonVector, b: VedicPersonVector): VedicMatchResult;
export declare function matchBatch(source: VedicPersonVector, targets: VedicPersonVector[]): VedicMatchResult[];
//# sourceMappingURL=vedic_ashtakoota.vectorized.engine.d.ts.map