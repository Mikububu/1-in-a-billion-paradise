/**
 * PROFILE ROUTES
 *
 * Handles user profile operations including AI portrait generation.
 * Enforces a limit of 3 portrait generations per person per calendar month.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=profile.d.ts.map