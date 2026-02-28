/**
 * RATE LIMITER MIDDLEWARE
 *
 * In-memory sliding window rate limiter for Hono.
 * Protects against brute-force attacks and API abuse.
 */

import { Context, Next } from 'hono';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  keyGenerator?: (c: Context) => string;  // Custom key generator
  message?: string;       // Custom error message
}

// In-memory store (resets on server restart)
const stores = new Map<string, Map<string, RateLimitEntry>>();

// Cleanup interval: prune expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [storeName, store] of stores) {
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => now - t < 120_000);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      stores.delete(storeName);
    }
  }
}, 60_000);

/**
 * Get client IP from Hono context.
 * Checks X-Forwarded-For (Fly.io/nginx) then falls back to connection info.
 */
function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Create a rate limiter middleware with the given config.
 */
export function createRateLimiter(name: string, config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (c: Context) => getClientIp(c),
    message = 'Too many requests. Please try again later.',
  } = config;

  // Initialize store for this limiter
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }

  return async (c: Context, next: Next) => {
    const store = stores.get(name)!;
    const key = keyGenerator(c);
    const now = Date.now();

    // Get or create entry
    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Check limit
    if (entry.timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      return c.json({ success: false, error: message }, 429);
    }

    // Record this request
    entry.timestamps.push(now);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - entry.timestamps.length));

    await next();
  };
}

// ── Pre-configured limiters ─────────────────────────────────────────

/** Global rate limiter: 100 requests per minute per IP */
export const globalLimiter = createRateLimiter('global', {
  windowMs: 60_000,
  maxRequests: 100,
});

/** Auth endpoints: 10 requests per minute per IP */
export const authLimiter = createRateLimiter('auth', {
  windowMs: 60_000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please wait a minute.',
});

/** LLM/Job endpoints: 5 requests per minute per user */
export const llmLimiter = createRateLimiter('llm', {
  windowMs: 60_000,
  maxRequests: 5,
  keyGenerator: (c: Context) => c.get('userId') || getClientIp(c),
  message: 'Rate limit reached for AI generation. Please wait before trying again.',
});

/** Webhook endpoints: 30 requests per minute per IP (RevenueCat) */
export const webhookLimiter = createRateLimiter('webhook', {
  windowMs: 60_000,
  maxRequests: 30,
});
