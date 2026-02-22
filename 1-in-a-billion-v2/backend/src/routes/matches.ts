import { Hono } from 'hono';
import { z } from 'zod';
import { matchEngine } from '../services/matchEngine';

const payloadSchema = z.object({
  birthDate: z.string(),
  birthTime: z.string(),
  timezone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  relationshipIntensity: z.number().min(0).max(10),
  relationshipMode: z.enum(['family', 'sensual']),
  primaryLanguage: z.string(),
  secondaryLanguage: z.string().optional(),
});

const detailSchema = payloadSchema.extend({
  matchId: z.string(),
});

const router = new Hono();

router.post('/preview', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  return c.json(matchEngine.getPreview(parsed));
});

router.post('/detail', async (c) => {
  const parsed = detailSchema.parse(await c.req.json());
  return c.json({ match: matchEngine.getDetail(parsed.matchId) });
});

export const matchesRouter = router;

