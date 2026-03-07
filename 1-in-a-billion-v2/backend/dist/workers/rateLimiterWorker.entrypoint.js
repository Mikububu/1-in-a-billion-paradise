"use strict";
/**
 * RATE LIMITER WORKER - Fly.io Process Entrypoint
 *
 * Starts the BullMQ worker that processes Replicate API calls
 * at the global rate limit (600 RPM).
 *
 * fly.toml process group:
 *   rate-limiter = "node dist/workers/rateLimiterWorker.entrypoint.js"
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rateLimiterWorker_1 = require("./rateLimiterWorker");
const redisClient_1 = require("../services/redisClient");
const replicateQueue_1 = require("../services/replicateQueue");
console.log('═══════════════════════════════════════════════════════════');
console.log('🚀 RATE LIMITER WORKER - Starting');
console.log('═══════════════════════════════════════════════════════════');
const { fastWorker, slowWorker } = (0, rateLimiterWorker_1.startRateLimiterWorker)();
// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n[RateLimiterWorker] ${signal} received - shutting down gracefully...`);
    await Promise.all([fastWorker.close(), slowWorker.close()]);
    await (0, replicateQueue_1.closeQueue)();
    await (0, redisClient_1.closeRedisConnections)();
    console.log('[RateLimiterWorker] Shutdown complete.');
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Keep process alive
process.on('uncaughtException', (error) => {
    console.error('[RateLimiterWorker] Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('[RateLimiterWorker] Unhandled rejection:', reason);
});
//# sourceMappingURL=rateLimiterWorker.entrypoint.js.map