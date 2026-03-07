/**
 * RATE LIMITER WORKER - Fly.io Process Entrypoint
 *
 * Starts the BullMQ worker that processes Replicate API calls
 * at the global rate limit (600 RPM).
 *
 * fly.toml process group:
 *   rate-limiter = "node dist/workers/rateLimiterWorker.entrypoint.js"
 */
export {};
//# sourceMappingURL=rateLimiterWorker.entrypoint.d.ts.map