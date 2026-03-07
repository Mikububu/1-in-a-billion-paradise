/**
 * RATE LIMITER MIDDLEWARE
 *
 * In-memory sliding window rate limiter for Hono.
 * Protects against brute-force attacks and API abuse.
 */
import { Context, Next } from 'hono';
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (c: Context) => string;
    message?: string;
}
/**
 * Create a rate limiter middleware with the given config.
 */
export declare function createRateLimiter(name: string, config: RateLimitConfig): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** Global rate limiter: 100 requests per minute per IP */
export declare const globalLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** Auth endpoints: 10 requests per minute per IP */
export declare const authLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** LLM/Job endpoints: 5 requests per minute per user */
export declare const llmLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** Polling endpoints: 120 requests per minute per user */
export declare const jobPollingLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** Webhook endpoints: 30 requests per minute per IP (RevenueCat) */
export declare const webhookLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
/** Admin endpoints: 30 requests per minute per IP */
export declare const adminLimiter: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 429, "json">) | undefined>;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map