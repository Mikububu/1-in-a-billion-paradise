"use strict";
/**
 * RATE LIMITER MIDDLEWARE
 *
 * In-memory sliding window rate limiter for Hono.
 * Protects against brute-force attacks and API abuse.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLimiter = exports.webhookLimiter = exports.jobPollingLimiter = exports.llmLimiter = exports.authLimiter = exports.globalLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
// In-memory store (resets on server restart)
const stores = new Map();
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
 * Defensive: some requests (e.g. CORS preflight) may have non-standard header objects.
 */
function getClientIp(c) {
    try {
        const forwarded = c.req.header('x-forwarded-for');
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        const realIp = c.req.header('x-real-ip');
        if (realIp)
            return realIp;
    }
    catch {
        // Header access failed (e.g. raw request headers not fully initialised)
    }
    return 'unknown';
}
/**
 * Create a rate limiter middleware with the given config.
 */
function createRateLimiter(name, config) {
    const { windowMs, maxRequests, keyGenerator = (c) => getClientIp(c), message = 'Too many requests. Please try again later.', } = config;
    // Initialize store for this limiter
    if (!stores.has(name)) {
        stores.set(name, new Map());
    }
    return async (c, next) => {
        // Wrap everything - if rate limiting fails for any reason, fail open
        try {
            const key = keyGenerator(c);
            const store = stores.get(name);
            if (!store) {
                await next();
                return;
            }
            const now = Date.now();
            let entry = store.get(key);
            if (!entry) {
                entry = { timestamps: [] };
                store.set(key, entry);
            }
            entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
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
        }
        catch {
            // Rate limiter error - fail open so the request still goes through
            await next();
        }
    };
}
// ── Pre-configured limiters ─────────────────────────────────────────
/** Global rate limiter: 100 requests per minute per IP */
exports.globalLimiter = createRateLimiter('global', {
    windowMs: 60_000,
    maxRequests: 100,
});
/** Auth endpoints: 10 requests per minute per IP */
exports.authLimiter = createRateLimiter('auth', {
    windowMs: 60_000,
    maxRequests: 10,
    message: 'Too many authentication attempts. Please wait a minute.',
});
/** LLM/Job endpoints: 5 requests per minute per user */
exports.llmLimiter = createRateLimiter('llm', {
    windowMs: 60_000,
    maxRequests: 5,
    keyGenerator: (c) => c.get('userId') || getClientIp(c),
    message: 'Rate limit reached for AI generation. Please wait before trying again.',
});
/** Polling endpoints: 120 requests per minute per user */
exports.jobPollingLimiter = createRateLimiter('job_polling', {
    windowMs: 60_000,
    maxRequests: 120,
    keyGenerator: (c) => c.get('userId') || getClientIp(c),
    message: 'Please slow down your requests.',
});
/** Webhook endpoints: 30 requests per minute per IP (RevenueCat) */
exports.webhookLimiter = createRateLimiter('webhook', {
    windowMs: 60_000,
    maxRequests: 30,
});
/** Admin endpoints: 30 requests per minute per IP */
exports.adminLimiter = createRateLimiter('admin', {
    windowMs: 60_000,
    maxRequests: 30,
    message: 'Too many admin requests. Please try again later.',
});
//# sourceMappingURL=rateLimiter.js.map