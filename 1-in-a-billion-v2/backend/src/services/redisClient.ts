/**
 * REDIS CLIENT — Singleton connection for BullMQ
 *
 * Reads REDIS_URL from env (Fly.io auto-populates this when you provision Redis).
 * Falls back to localhost:6379 for local dev.
 *
 * IMPORTANT: We import IORedis from ioredis directly but cast to `any` when
 * passing to BullMQ, because BullMQ bundles its own ioredis version and the
 * types are incompatible even though the runtime behavior is identical.
 */

import IORedis from 'ioredis';

let defaultConnection: IORedis | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  return url;
}

/**
 * Create a new IORedis connection (BullMQ needs its own instances).
 * Use this when constructing Queue or Worker objects.
 *
 * Cast the return to `any` when passing to BullMQ constructors to
 * avoid type conflicts between ioredis versions.
 */
export function createRedisConnection(): any {
  const url = getRedisUrl();
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  connection.on('connect', () => {
    console.log('[Redis] Connected to', url.replace(/\/\/.*@/, '//<credentials>@'));
  });

  return connection;
}

/**
 * Get (or create) a shared default connection for reads/general use.
 * BullMQ Queue and Worker each need their OWN connections, so use
 * createRedisConnection() for those.
 */
export function getDefaultRedisConnection(): any {
  if (!defaultConnection || (defaultConnection as any).status === 'end') {
    defaultConnection = createRedisConnection();
  }
  return defaultConnection;
}

/**
 * Gracefully close all Redis connections (for clean shutdown).
 */
export async function closeRedisConnections(): Promise<void> {
  if (defaultConnection) {
    await defaultConnection.quit().catch(() => {});
    defaultConnection = null;
  }
}
