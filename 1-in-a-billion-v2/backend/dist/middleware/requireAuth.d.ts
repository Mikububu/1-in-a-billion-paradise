/**
 * REQUIRE AUTH MIDDLEWARE
 *
 * Verifies Supabase JWT Bearer token and sets userId on context.
 * Replaces the insecure X-User-Id header pattern.
 */
import { Context, Next } from 'hono';
import type { AppEnv } from '../types/hono';
/**
 * Middleware: Require authenticated user via Supabase JWT.
 * Sets c.var.userId on success.
 */
export declare function requireAuth(c: Context<AppEnv>, next: Next): Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
}, 503, "json">) | undefined>;
/**
 * Helper: Get authenticated userId from context (set by requireAuth middleware).
 * Returns null if middleware was not applied.
 */
export declare function getAuthUserId(c: Context<AppEnv>): string | null;
/**
 * Optional auth: tries to authenticate but doesn't block if no token.
 * Sets userId if token is valid, otherwise sets null.
 */
export declare function optionalAuth(c: Context<AppEnv>, next: Next): Promise<void>;
//# sourceMappingURL=requireAuth.d.ts.map