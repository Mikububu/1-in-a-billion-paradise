import { HookReading, ReadingPayload } from '../../types';
type HookRequest = {
    type: HookReading['type'];
    sign: string;
    payload: ReadingPayload;
    placements?: {
        sunSign: string;
        moonSign: string;
        risingSign: string;
        sunDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
        moonDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
        ascendantDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
        sunHouse?: number;
        moonHouse?: number;
    };
};
type ExtendedRequest = {
    system: string;
    placements: {
        sunSign: string;
        moonSign: string;
        risingSign: string;
        sunDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
        moonDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
        ascendantDegree?: {
            sign: string;
            degree: number;
            minute: number;
        };
    };
    subjectName: string;
    longForm: boolean;
};
export declare const deepSeekClient: {
    generateHookReading(request: HookRequest): Promise<{
        reading: HookReading;
        source: "deepseek" | "fallback";
    }>;
    generateExtendedReading(request: ExtendedRequest): Promise<{
        reading: {
            content: string;
        };
        source: "deepseek";
    }>;
    generateSynastryReading(request: {
        system: string;
        person1: {
            name: string;
            placements: any;
        };
        person2: {
            name: string;
            placements: any;
        };
    }): Promise<{
        reading: any;
        source: "deepseek";
    }>;
};
export {};
//# sourceMappingURL=deepseekClient.d.ts.map