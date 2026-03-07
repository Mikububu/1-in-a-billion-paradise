/**
 * REDIS CLIENT - Singleton connection for BullMQ
 *
 * Reads REDIS_URL from env (Fly.io auto-populates this when you provision Redis).
 * Falls back to localhost:6379 for local dev.
 *
 * IMPORTANT: We import IORedis from ioredis directly but cast to `any` when
 * passing to BullMQ, because BullMQ bundles its own ioredis version and the
 * types are incompatible even though the runtime behavior is identical.
 */
/**
 * Create a new IORedis connection (BullMQ needs its own instances).
 * Use this when constructing Queue or Worker objects.
 *
 * Cast the return to `any` when passing to BullMQ constructors to
 * avoid type conflicts between ioredis versions.
 */
export declare function createRedisConnection(): any;
/**
 * Get (or create) a shared default connection for reads/general use.
 * BullMQ Queue and Worker each need their OWN connections, so use
 * createRedisConnection() for those.
 */
export declare function getDefaultRedisConnection(): any;
/**
 * Gracefully close all Redis connections (for clean shutdown).
 */
export declare function closeRedisConnections(): Promise<void>;
//# sourceMappingURL=redisClient.d.ts.map