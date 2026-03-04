/**
 * RATE LIMITER WORKER - Fly.io Process Entrypoint
 *
 * Starts the BullMQ worker that processes Replicate API calls
 * at the global rate limit (600 RPM).
 *
 * fly.toml process group:
 *   rate-limiter = "node dist/workers/rateLimiterWorker.entrypoint.js"
 */

import { startRateLimiterWorker } from './rateLimiterWorker';
import { closeRedisConnections } from '../services/redisClient';
import { closeQueue } from '../services/replicateQueue';

console.log('═══════════════════════════════════════════════════════════');
console.log('🚀 RATE LIMITER WORKER - Starting');
console.log('═══════════════════════════════════════════════════════════');

const { fastWorker, slowWorker } = startRateLimiterWorker();

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[RateLimiterWorker] ${signal} received - shutting down gracefully...`);
  await Promise.all([fastWorker.close(), slowWorker.close()]);
  await closeQueue();
  await closeRedisConnections();
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
