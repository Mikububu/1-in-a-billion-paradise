/**
 * INTERNAL PEOPLE SCALING ROUTES
 *
 * Purpose: allow the admin panel (server-side) to kick off "people scaling"
 * (match index recomputation) without requiring the full admin JWT system yet.
 *
 * Security model (V0):
 * - Requires header: `x-admin-secret: <ADMIN_PANEL_SECRET>`
 *
 * Later we can migrate this to the proper `/api/admin/*` routes protected by admin JWT + permissions.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=internalPeopleScaling.d.ts.map