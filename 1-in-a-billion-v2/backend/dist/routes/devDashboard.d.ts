/**
 * DEV DASHBOARD - View all jobs and readings
 *
 * Endpoint to monitor all background jobs, view status, and listen to audio.
 * Useful for stress testing and checking results.
 *
 * GET /api/dev/dashboard - List all jobs with status
 * GET /api/dev/jobs/:jobId - Get specific job details
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=devDashboard.d.ts.map