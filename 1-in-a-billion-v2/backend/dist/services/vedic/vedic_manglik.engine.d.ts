export declare const MANGLIK_HOUSES: Set<number>;
export interface ManglikInput {
    marsHouse: number;
    lagnaSign: number;
    moonSign: number;
    venusSign?: number;
}
export declare function isManglik(marsHouse: number): boolean;
export declare function manglikFromLagna(input: ManglikInput): boolean;
export declare function manglikFromMoon(marsHouse: number, moonHouse: number): boolean;
export declare function manglikFromVenus(marsHouse: number, venusHouse: number): boolean;
export declare function manglikCancellation(marsHouse: number, marsSign: number, lagnaSign: number): boolean;
export interface ManglikMatchResult {
    maleManglik: boolean;
    femaleManglik: boolean;
    compatible: boolean;
    cancellationApplied: boolean;
}
export declare function manglikMatch(male: ManglikInput, female: ManglikInput, maleMarsSign: number, femaleMarsSign: number): ManglikMatchResult;
export declare function manglikPenalty(maleManglik: boolean, femaleManglik: boolean): number;
//# sourceMappingURL=vedic_manglik.engine.d.ts.map