/**
 * REQUIRE AUTH MIDDLEWARE
 *
 * Verifies Supabase JWT Bearer token and sets userId on context.
 * Replaces the insecure X-User-Id header pattern.
 */

import { Context, Next } from 'hono';
import { createSupabaseUserClientFromAccessToken } from '../services/supabaseClient';
import type { AppEnv } from '../types/hono';

/**
 * Extract Bearer token from Authorization header.
 */
function getBearerToken(c: Context<AppEnv>): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Middleware: Require authenticated user via Supabase JWT.
 * Sets c.var.userId on success.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const token = getBearerToken(c);
  if (!token) {
    return c.json({ success: false, error: 'Missing authorization token' }, 401);
  }

  try {
    const userClient = createSupabaseUserClientFromAccessToken(token);
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
  } catch (err) {
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
}

/**
 * Helper: Get authenticated userId from context (set by requireAuth middleware).
 * Returns null if middleware was not applied.
 */
export function getAuthUserId(c: Context<AppEnv>): string | null {
  return c.get('userId') || null;
}

/**
 * Optional auth: tries to authenticate but doesn't block if no token.
 * Sets userId if token is valid, otherwise sets null.
 */
export async function optionalAuth(c: Context<AppEnv>, next: Next) {
  const token = getBearerToken(c);
  if (token) {
    try {
      const userClient = createSupabaseUserClientFromAccessToken(token);
      if (userClient) {
        const { data: { user }, error } = await userClient.auth.getUser(token);
        if (!error && user) {
          c.set('userId', user.id);
        }
      }
    } catch {
      // Silent fail for optional auth
    }
  }
  await next();
}
