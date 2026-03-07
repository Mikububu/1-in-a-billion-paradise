/**
 * JOB ROUTES - 5-PART NUCLEAR APPROACH
 *
 * Nuclear Package:
 * - 5 parts (Portraits, Hunger, Abyss, Labyrinth, Mirror)
 * - Each part ~6000 words (max_tokens: 8192)
 * - Total ~30,000 words
 * - Progressive generation: TEXT → PDF → AUDIO per part
 *
 * Uses the new modular prompt system for Claude Desktop-quality output.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=jobs.d.ts.map