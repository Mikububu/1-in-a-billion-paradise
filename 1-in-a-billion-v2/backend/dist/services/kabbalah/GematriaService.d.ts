export interface GematriaInfo {
    secular: string;
    hebrew: string;
    letters: string[];
    gematria: number;
}
export declare class GematriaService {
    /**
     * Transliterate English name to Hebrew letters
     */
    transliterate(name: string): string;
    /**
     * Get gematria value for a Hebrew string
     */
    calculateGematria(hebrew: string): number;
    /**
     * Process a name into full gematria info
     */
    processName(name: string): GematriaInfo;
}
export declare const gematriaService: GematriaService;
//# sourceMappingURL=GematriaService.d.ts.map