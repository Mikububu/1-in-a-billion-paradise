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
export declare const readingsClient: {
    generateHookReading(request: HookRequest): Promise<{
        reading: HookReading;
        source: "deepseek" | "fallback";
    }>;
};
export {};
//# sourceMappingURL=readingsClient.d.ts.map