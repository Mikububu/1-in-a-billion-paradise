/**
 * VEDIC MATCHMAKING API ROUTES
 *
 * REST endpoints for Jyotish matchmaking computation.
 * Uses verified scoring engine and vectorized tables.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const vedicRoutes: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default vedicRoutes;
//# sourceMappingURL=vedic.d.ts.map