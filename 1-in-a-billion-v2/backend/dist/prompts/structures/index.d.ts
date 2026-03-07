/**
 * STRUCTURES INDEX
 *
 * Exports all reading structure modules.
 */
export * from './individual';
export * from './overlay';
export * from './nuclear';
export type ReadingType = 'individual' | 'overlay' | 'nuclear';
export declare const READING_CONFIGS: {
    individual: {
        totalWords: number;
        audioMinutes: number;
        apiCalls: number;
    };
    overlay: {
        totalWords: number;
        audioMinutes: number;
        apiCalls: number;
    };
    nuclear: {
        totalWords: number;
        audioMinutes: number;
        apiCalls: number;
    };
};
//# sourceMappingURL=index.d.ts.map