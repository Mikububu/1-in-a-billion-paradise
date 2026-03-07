/**
 * REPLICATE RATE LIMITER
 *
 * Centralized, process-local pacing for Replicate API calls.
 * - Serializes Replicate requests within a process
 * - Enforces minimum spacing derived from account RPM / expected process count
 * - Applies adaptive cooldown when 429/rate-limit responses appear
 *
 * Note: this is process-local. Cross-instance coordination still depends on
 * deploy sizing and env configuration (REPLICATE_EXPECTED_PROCESSES).
 */
export declare function isReplicateRateLimitError(error: unknown): boolean;
export declare function runReplicateWithRateLimit<T>(label: string, operation: () => Promise<T>): Promise<T>;
//# sourceMappingURL=replicateRateLimiter.d.ts.map