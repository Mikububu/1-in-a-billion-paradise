import { VedicMatchResult } from './vedic_ashtakoota.vectorized.engine';
interface NarrationProfile {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
}
export declare class VedicAudioGenerator {
    private apiKey;
    constructor(apiKey: string);
    generateNarrationScript(match: VedicMatchResult, personA: NarrationProfile, personB: NarrationProfile): {
        cover: string;
        intro: string;
        birthData: string;
        ashtakoota: string;
        dosha: string;
        dasha: string;
        conclusion: string;
    };
    synthesizeSegment(text: string): Promise<Int16Array>;
    generateSilence(durationSeconds: number): Int16Array;
    createAudiobook(match: VedicMatchResult, profiles: {
        a: NarrationProfile;
        b: NarrationProfile;
    }): Promise<Int8Array>;
    private numberToWords;
}
export {};
//# sourceMappingURL=vedic_audio.generator.d.ts.map