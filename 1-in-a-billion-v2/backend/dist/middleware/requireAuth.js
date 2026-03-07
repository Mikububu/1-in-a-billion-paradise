"use strict";
/**
 * REQUIRE AUTH MIDDLEWARE
 *
 * Verifies Supabase JWT Bearer token and sets userId on context.
 * Replaces the insecure X-User-Id header pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.getAuthUserId = getAuthUserId;
exports.optionalAuth = optionalAuth;
const supabaseClient_1 = require("../services/supabaseClient");
/**
 * Extract Bearer token from Authorization header.
 */
function getBearerToken(c) {
    const auth = c.req.header('Authorization') || c.req.header('authorization');
    if (!auth)
        return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}
/**
 * Middleware: Require authenticated user via Supabase JWT.
 * Sets c.var.userId on success.
 */
async function requireAuth(c, next) {
    const token = getBearerToken(c);
    if (!token) {
        return c.json({ success: false, error: 'Missing authorization token' }, 401);
    }
    try {
        const userClient = (0, supabaseClient_1.createSupabaseUserClientFromAccessToken)(token);
        if (!userClient) {
            return c.json({ success: false, error: 'Authentication service unavailable' }, 503);
        }
        const { data: { user }, error } = await userClient.auth.getUser(token);
        if (error || !user) {
            return c.json({ success: false, error: 'Invalid or expired token' }, 401);
        }
        // Set userId on context for downstream handlers
        c.set('userId', user.id);
        await next();
    }
    catch (err) {
        return c.json({ success: false, error: 'Authentication failed' }, 401);
    }
}
/**
 * Helper: Get authenticated userId from context (set by requireAuth middleware).
 * Returns null if middleware was not applied.
 */
function getAuthUserId(c) {
    return c.get('userId') || null;
}
/**
 * Optional auth: tries to authenticate but doesn't block if no token.
 * Sets userId if token is valid, otherwise sets null.
 */
async function optionalAuth(c, next) {
    const token = getBearerToken(c);
    if (token) {
        try {
            const userClient = (0, supabaseClient_1.createSupabaseUserClientFromAccessToken)(token);
            if (userClient) {
                const { data: { user }, error } = await userClient.auth.getUser(token);
                if (!error && user) {
                    c.set('userId', user.id);
                }
            }
        }
        catch {
            // Silent fail for optional auth
        }
    }
    await next();
}
//# sourceMappingURL=requireAuth.js.map