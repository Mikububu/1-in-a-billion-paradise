/**
 * COST TRACKING SERVICE
 *
 * Tracks and calculates costs for all API calls:
 * - LLM providers (Claude, DeepSeek, OpenAI)
 * - Replicate API (TTS audio generation)
 * - MiniMax song generation
 *
 * Pricing as of Jan 2026 (per 1M tokens unless noted):
 */
export declare function getPricingTiers(): Promise<Record<string, any>>;
export declare const LLM_PRICING: {
    deepseek: {
        name: string;
        inputPer1M: number;
        outputPer1M: number;
        model: string;
    };
    claude: {
        name: string;
        inputPer1M: number;
        outputPer1M: number;
        model: string;
    };
    openai: {
        name: string;
        inputPer1M: number;
        outputPer1M: number;
        model: string;
    };
};
export declare const REPLICATE_PRICING: {
    perSecond: number;
    perMinute: number;
};
export declare const MINIMAX_PRICING: {
    perSong: number;
    ttsPer10KChars: number;
};
export interface LLMUsage {
    provider: 'deepseek' | 'claude' | 'openai';
    inputTokens: number;
    outputTokens: number;
    model?: string;
}
export interface ReplicateUsage {
    executionTimeMs: number;
    gpuType?: string;
}
export declare function calculateLLMCost(usage: LLMUsage): number;
export declare function calculateReplicateCost(usage: ReplicateUsage): number;
export interface CostLogEntry {
    jobId: string;
    taskId?: string;
    provider: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    executionTimeMs?: number;
    costUsd: number;
    label?: string;
}
/**
 * Log a cost entry to the database
 */
export declare function logCost(entry: CostLogEntry): Promise<boolean>;
/**
 * Log LLM cost with automatic calculation
 */
export declare function logLLMCost(jobId: string, taskId: string | undefined, usage: LLMUsage, label?: string): Promise<number>;
/**
 * Log Replicate cost with automatic calculation
 */
export declare function logReplicateCost(jobId: string, taskId: string | undefined, executionTimeMs: number, label?: string): Promise<number>;
/**
 * Log MiniMax TTS cost with automatic calculation
 */
export declare function logMinimaxTtsCost(jobId: string, taskId: string | undefined, charsLength: number, label?: string): Promise<number>;
/**
 * Log Google AI Studio (Portraits) cost
 */
export declare function logGoogleAiStudioCost(jobId: string, taskId: string | undefined, numImages: number, label?: string): Promise<number>;
/**
 * Log Google TTS cost
 */
export declare function logGoogleTtsCost(jobId: string, taskId: string | undefined, charsLength: number, label?: string): Promise<number>;
export declare const logRunPodCost: typeof logReplicateCost;
export declare const calculateRunPodCost: typeof calculateReplicateCost;
export interface CostSummary {
    totalCost: number;
    byProvider: Record<string, number>;
    byJob: Array<{
        jobId: string;
        jobType: string;
        totalCost: number;
        createdAt: string;
    }>;
    period: {
        start: string;
        end: string;
    };
}
/**
 * Get cost summary for a date range
 */
export declare function getCostSummary(startDate: Date, endDate: Date): Promise<CostSummary | null>;
/**
 * Get today's costs
 */
export declare function getTodayCosts(): Promise<CostSummary | null>;
/**
 * Get this month's costs
 */
export declare function getMonthCosts(): Promise<CostSummary | null>;
//# sourceMappingURL=costTracking.d.ts.map