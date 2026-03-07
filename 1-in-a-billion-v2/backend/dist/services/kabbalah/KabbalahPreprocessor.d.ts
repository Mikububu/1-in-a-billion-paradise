import { HebrewDateInfo } from './HebrewCalendarService';
import { GematriaInfo } from './GematriaService';
export interface KabbalahPayload {
    hebrewDate: HebrewDateInfo;
    birthTimeContext: {
        normalized: string;
        sacredContext?: string;
    };
    fullName: {
        firstName: GematriaInfo;
        surname: GematriaInfo;
        totalGematria: number;
    };
    lifeEvents?: {
        rawText: string;
    };
}
export declare class KabbalahPreprocessor {
    /**
     * Preprocess all data for a Kabbalah reading
     */
    preprocess(params: {
        birthDate: string;
        birthTime: string;
        timezone: string;
        firstName: string;
        surname: string;
        lifeEvents?: string;
    }): Promise<KabbalahPayload>;
}
export declare const kabbalahPreprocessor: KabbalahPreprocessor;
//# sourceMappingURL=KabbalahPreprocessor.d.ts.map