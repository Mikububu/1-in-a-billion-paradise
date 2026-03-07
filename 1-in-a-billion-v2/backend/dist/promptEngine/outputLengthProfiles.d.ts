import { ReadingKind } from './types';
export type OutputLengthContract = {
    targetWordsMin: number;
    targetWordsMax: number;
    hardFloorWords: number;
    note?: string;
};
export declare function getDefaultOutputLengthContract(readingKind: ReadingKind): OutputLengthContract;
export declare function normalizeOutputLengthContract(raw: any): OutputLengthContract | undefined;
//# sourceMappingURL=outputLengthProfiles.d.ts.map