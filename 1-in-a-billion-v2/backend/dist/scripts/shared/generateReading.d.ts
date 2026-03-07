import type { SystemId } from '../../promptEngine/types';
export declare function safeFileToken(value: string): string;
export type GenerateSingleReadingOptions = {
    system: SystemId;
    personName: string;
    styleLayerId: string;
    outDir: string;
    fileBase: string;
    chartData: string;
    chartDataPerson1?: string;
    chartDataPerson2?: string;
    payloadBase: Record<string, any>;
    hardFloorWords: number;
    docType: 'individual' | 'overlay' | 'verdict';
};
export type GenerateSingleReadingResult = {
    reading: string;
    chartDataForPrompt: string;
    resolvedStyleLayerId: string;
    promptPath: string;
    userPromptPath: string;
    systemPromptPath: string;
    readingPath: string;
};
export declare function generateSingleReading(options: GenerateSingleReadingOptions): Promise<GenerateSingleReadingResult>;
//# sourceMappingURL=generateReading.d.ts.map