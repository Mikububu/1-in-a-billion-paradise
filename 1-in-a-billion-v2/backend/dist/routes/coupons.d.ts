/**
 * COUPON CODE ROUTES
 *
 * GET  /api/coupons/validate?code=XXX  - Check if a code is valid (public, no auth needed before signup)
 * POST /api/coupons/redeem              - Redeem a code and grant subscription (no auth - used pre-signup)
 * POST /api/coupons/admin/create        - Create a new coupon (admin only, requires auth)
 * GET  /api/coupons/admin/list          - List all coupons (admin only)
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const coupons: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default coupons;
//# sourceMappingURL=coupons.d.ts.map