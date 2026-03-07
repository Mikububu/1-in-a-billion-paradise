/**
 * ADMIN ROUTES
 *
 * Role-based admin system for managing users, jobs, and platform operations.
 * All routes require admin authentication and appropriate permissions.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=admin.d.ts.map