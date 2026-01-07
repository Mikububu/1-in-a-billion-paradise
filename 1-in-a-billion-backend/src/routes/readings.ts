import { Hono } from 'hono';
import { z } from 'zod';
import { ReadingResponse } from '../types';
import { swissEngine } from '../services/swissEphemeris';
import { deepSeekClient } from '../services/text/deepseekClient';
import { llm } from '../services/llm';
import { ResponseCache } from '../services/cache';
// Prompts are built inline in deepseekClient.ts

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
  subjectName: z.string().optional(),
  isPartnerReading: z.boolean().optional(),
});

const sunCache = new ResponseCache<ReadingResponse>();
const moonCache = new ResponseCache<ReadingResponse>();
const risingCache = new ResponseCache<ReadingResponse>();

const buildResponse = (reading: ReadingResponse['reading'], cacheHit: boolean, source: 'deepseek' | 'fallback'): ReadingResponse => ({
  reading,
  metadata: {
    cacheHit,
    generatedAt: new Date().toISOString(),
    source,
  },
});

const router = new Hono();

router.post('/sun', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const cacheKey = JSON.stringify({ type: 'sun', parsed });
  const cached = sunCache.get(cacheKey);
  if (cached) return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
    type: 'sun', 
    sign: placements.sunSign, 
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, false, source);
  sunCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/moon', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const cacheKey = JSON.stringify({ type: 'moon', parsed });
  const cached = moonCache.get(cacheKey);
  if (cached) return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
    type: 'moon', 
    sign: placements.moonSign, 
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, false, source);
  moonCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/rising', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const cacheKey = JSON.stringify({ type: 'rising', parsed });
  const cached = risingCache.get(cacheKey);
  if (cached) return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
    type: 'rising', 
    sign: placements.risingSign, 
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, false, source);
  risingCache.set(cacheKey, response);
  return c.json(response);
});

// Extended reading endpoint for full readings
const extendedSchema = z.object({
  system: z.string(),
  birthDate: z.string(),
  birthTime: z.string(),
  timezone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  relationshipIntensity: z.number().optional(),
  relationshipMode: z.string().optional(),
  primaryLanguage: z.string().optional(),
  provider: z.string().optional(),
  longForm: z.boolean().optional(),
  subjectName: z.string().optional(),
  isPartnerReading: z.boolean().optional(),
});

const extendedCache = new ResponseCache<any>();

router.post('/extended', async (c) => {
  const body = await c.req.json();
  const parsed = extendedSchema.parse(body);
  const cacheKey = JSON.stringify({ type: 'extended', parsed });
  const cached = extendedCache.get(cacheKey);
  if (cached) return c.json(cached);

  // Get placements
  const placements = await swissEngine.computePlacements({
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    relationshipIntensity: parsed.relationshipIntensity || 5,
    relationshipMode: (parsed.relationshipMode || 'sensual') as 'family' | 'sensual',
    primaryLanguage: parsed.primaryLanguage || 'en',
  });

  // Generate extended reading
  const { reading, source } = await deepSeekClient.generateExtendedReading({
    system: parsed.system,
    placements,
    subjectName: parsed.subjectName || 'You',
    longForm: parsed.longForm || false,
  });

  const response = {
    reading: { content: reading.content },
    metadata: { source, generatedAt: new Date().toISOString() },
  };
  
  extendedCache.set(cacheKey, response);
  return c.json(response);
});

// Synastry reading endpoint for compatibility analysis
const synastrySchema = z.object({
  system: z.string(),
  person1: z.object({
    name: z.string(),
    birthDate: z.string(),
    birthTime: z.string(),
    timezone: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  person2: z.object({
    name: z.string(),
    birthDate: z.string(),
    birthTime: z.string(),
    timezone: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  relationshipIntensity: z.number().optional(),
});

const synastryCache = new ResponseCache<any>();

router.post('/synastry', async (c) => {
  const body = await c.req.json();
  const parsed = synastrySchema.parse(body);
  const cacheKey = JSON.stringify({ type: 'synastry', parsed });
  const cached = synastryCache.get(cacheKey);
  if (cached) return c.json(cached);

  // Get placements for both people
  const placements1 = await swissEngine.computePlacements({
    birthDate: parsed.person1.birthDate,
    birthTime: parsed.person1.birthTime,
    timezone: parsed.person1.timezone,
    latitude: parsed.person1.latitude,
    longitude: parsed.person1.longitude,
    relationshipIntensity: parsed.relationshipIntensity || 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  const placements2 = await swissEngine.computePlacements({
    birthDate: parsed.person2.birthDate,
    birthTime: parsed.person2.birthTime,
    timezone: parsed.person2.timezone,
    latitude: parsed.person2.latitude,
    longitude: parsed.person2.longitude,
    relationshipIntensity: parsed.relationshipIntensity || 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  // Generate synastry reading
  const { reading, source } = await deepSeekClient.generateSynastryReading({
    system: parsed.system,
    person1: { name: parsed.person1.name, placements: placements1 },
    person2: { name: parsed.person2.name, placements: placements2 },
  });

  const response = {
    reading,
    metadata: { source, generatedAt: new Date().toISOString() },
  };
  
  synastryCache.set(cacheKey, response);
  return c.json(response);
});

export const readingsRouter = router;

