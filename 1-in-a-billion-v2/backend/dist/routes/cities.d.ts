/**
 * CITY SEARCH API
 *
 * GET /api/cities/search?q=<query>
 *
 * Uses Google Places API to search for cities worldwide.
 * Returns city name, country, timezone, and coordinates.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=cities.d.ts.map