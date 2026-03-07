type IntensityDescriptor = {
    min: number;
    max: number;
    caption: string;
    tone: 'calm' | 'balanced' | 'fiery';
};
export declare const describeIntensity: (value: number) => IntensityDescriptor;
export declare const summarizeIntensity: (value: number) => string;
export declare const toneFromIntensity: (value: number) => string;
export {};
//# sourceMappingURL=intensity.d.ts.map