import { Hono } from 'hono';
import { z } from 'zod';
import { ReadingResponse } from '../types';
import { swissEngine } from '../services/swissEphemeris';
import { readingsClient } from '../services/text/readingsClient';
import type { AppEnv } from '../types/hono';
import { llm } from '../services/llm';
import { ResponseCache } from '../services/cache';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';

const payloadSchema = z.object({
  birthDate: z.string().max(100),
  birthTime: z.string().max(100),
  timezone: z.string().max(100),
  latitude: z.number(),
  longitude: z.number(),
  birthPlace: z.string().max(200).optional(), // City name for poetic intro
  relationshipIntensity: z.number().min(0).max(10),
  relationshipMode: z.enum(['family', 'sensual']),
  primaryLanguage: z.string().max(100),
  secondaryLanguage: z.string().max(100).optional(),
  subjectName: z.string().max(200).optional(),
  isPartnerReading: z.boolean().optional(),
});

const sunCache = new ResponseCache<ReadingResponse>();
const moonCache = new ResponseCache<ReadingResponse>();
const risingCache = new ResponseCache<ReadingResponse>();

const buildResponse = (
  reading: ReadingResponse['reading'],
  placements: ReadingResponse['placements'] | undefined,
  cacheHit: boolean,
  source: 'deepseek' | 'fallback'
): ReadingResponse => ({
  reading,
  placements,
  metadata: {
    cacheHit,
    generatedAt: new Date().toISOString(),
    source,
  },
});

const router = new Hono<AppEnv>();

/**
 * Auto-correct timezone if UTC is sent but coordinates are far from GMT.
 * Uses Google Timezone API as a safety net.
 */
async function correctTimezoneIfNeeded(timezone: string, latitude: number, longitude: number, label: string): Promise<string> {
  if (timezone !== 'UTC') return timezone;
  const expectedOffset = Math.round(longitude / 15);
  if (Math.abs(expectedOffset) <= 1) return timezone;

  logger.error(`[${label}] TIMEZONE BUG DETECTED! Timezone is UTC but coordinates suggest offset`, {
    timezone, longitude,
    expectedOffset: `UTC${expectedOffset >= 0 ? '+' : ''}${expectedOffset}`,
    coordinates: `${latitude}, ${longitude}`,
  });

  try {
    const { getApiKey } = await import('../services/apiKeys');
    const googleKey = await getApiKey('google_places');
    if (googleKey) {
      const timestamp = Math.floor(Date.now() / 1000);
      const tzUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${googleKey}`;
      const tzResponse = await fetch(tzUrl);
      const tzData = await tzResponse.json();
      if (tzData.status === 'OK' && tzData.timeZoneId) {
        logger.info(`[${label}] AUTO-CORRECTED timezone: UTC -> ${tzData.timeZoneId}`);
        return tzData.timeZoneId;
      }
    }
  } catch (tzErr) {
    logger.warn(`[${label}] Failed to auto-correct timezone`, { error: String(tzErr) });
  }
  return timezone;
}

// Placements endpoint (Swiss Ephemeris only)
// Used by mobile to compute Sun/Moon/Rising immediately after saving a person.
const placementsSchema = z.object({
  birthDate: z.string().max(100),
  birthTime: z.string().max(100),
  timezone: z.string().max(100),
  latitude: z.number(),
  longitude: z.number(),
  system: z.enum(['western', 'vedic']).optional().default('western'),
});

router.post('/placements', requireAuth, async (c) => {
  const parsed = placementsSchema.parse(await c.req.json());

  // DEBUG: Log incoming data for troubleshooting
  logger.info('[Placements] Incoming request', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    system: parsed.system,
  });

  // Auto-correct timezone if UTC but coordinates suggest otherwise
  const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Placements');

  // VALIDATION: Reject invalid coordinates (0,0 is in the middle of the ocean)
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    logger.error('[Placements] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }

  // Swiss engine expects a ReadingPayload; provide safe defaults for non-reading fields.
  const placements = await swissEngine.computePlacements({
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: correctedTimezone, // Use corrected timezone (auto-fixed if UTC bug detected)
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    relationshipIntensity: 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  } as any);

  // If vedic requested, return sidereal signs in the top-level fields
  // so the mobile client can use a single normalize function.
  if (parsed.system === 'vedic' && (placements as any)?.sidereal) {
    const sid = (placements as any).sidereal;
    return c.json({
      placements: {
        sunSign: sid.suryaRashi,
        moonSign: sid.chandraRashi,
        risingSign: sid.lagnaSign,
        // Still include western degree objects for now; vedic degrees are available via placements.sidereal.grahas if needed later.
        sunDegree: placements.sunDegree,
        moonDegree: placements.moonDegree,
        risingDegree: placements.ascendantDegree,
      },
    });
  }

  return c.json({ placements });
});

router.post('/sun', requireAuth, async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';

  // DEBUG: Log incoming data
  logger.info('[Sun] Incoming request', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });

  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    logger.error('[Sun] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }

  // Auto-correct timezone if needed
  const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Sun');
  const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;

  const cacheKey = JSON.stringify({ type: 'sun', parsed: correctedParsed });
  if (!nocache) {
    const cached = sunCache.get(cacheKey);
    if (cached) {
      logger.info('[Sun] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    logger.info('[Sun] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(correctedParsed);
  const { reading, source } = await readingsClient.generateHookReading({
    type: 'sun',
    sign: placements.sunSign,
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, placements as any, false, source);
  sunCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/moon', requireAuth, async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';

  // DEBUG: Log incoming data
  logger.info('[Moon] Incoming request', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });

  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    logger.error('[Moon] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }

  // Auto-correct timezone if needed
  const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Moon');
  const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;

  const cacheKey = JSON.stringify({ type: 'moon', parsed: correctedParsed });
  if (!nocache) {
    const cached = moonCache.get(cacheKey);
    if (cached) {
      logger.info('[Moon] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    logger.info('[Moon] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(correctedParsed);
  const { reading, source } = await readingsClient.generateHookReading({
    type: 'moon',
    sign: placements.moonSign,
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, placements as any, false, source);
  moonCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/rising', requireAuth, async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';

  // DEBUG: Log incoming data
  logger.info('[Rising] Incoming request', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });

  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    logger.error('[Rising] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }

  // Auto-correct timezone if needed
  const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Rising');
  const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;

  const cacheKey = JSON.stringify({ type: 'rising', parsed: correctedParsed });
  if (!nocache) {
    const cached = risingCache.get(cacheKey);
    if (cached) {
      logger.info('[Rising] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    logger.info('[Rising] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(correctedParsed);
  const { reading, source } = await readingsClient.generateHookReading({
    type: 'rising',
    sign: placements.risingSign,
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, placements as any, false, source);
  risingCache.set(cacheKey, response);
  return c.json(response);
});

// Extended reading endpoint for full readings
const extendedSchema = z.object({
  system: z.string().max(100),
  birthDate: z.string().max(100),
  birthTime: z.string().max(100),
  timezone: z.string().max(100),
  latitude: z.number(),
  longitude: z.number(),
  relationshipIntensity: z.number().optional(),
  relationshipMode: z.string().max(100).optional(),
  primaryLanguage: z.string().max(100).optional(),
  provider: z.string().max(100).optional(),
  longForm: z.boolean().optional(),
  subjectName: z.string().max(200).optional(),
  isPartnerReading: z.boolean().optional(),
});

const extendedCache = new ResponseCache<any>();

router.post('/extended', requireAuth, async (c) => {
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
  const { reading, source } = await readingsClient.generateExtendedReading({
    system: parsed.system,
    placements,
    birthData: {
      birthDate: parsed.birthDate,
      birthTime: parsed.birthTime,
      timezone: parsed.timezone,
    },
    subjectName: parsed.subjectName || 'You',
    longForm: parsed.longForm || false,
    language: parsed.primaryLanguage || 'en',
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
  system: z.string().max(100),
  person1: z.object({
    name: z.string().max(200),
    birthDate: z.string().max(100),
    birthTime: z.string().max(100),
    timezone: z.string().max(100),
    latitude: z.number(),
    longitude: z.number(),
  }),
  person2: z.object({
    name: z.string().max(200),
    birthDate: z.string().max(100),
    birthTime: z.string().max(100),
    timezone: z.string().max(100),
    latitude: z.number(),
    longitude: z.number(),
  }),
  relationshipIntensity: z.number().optional(),
  primaryLanguage: z.string().max(100).optional(),
});

const synastryCache = new ResponseCache<any>();

router.post('/synastry', requireAuth, async (c) => {
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
  const { reading, source } = await readingsClient.generateSynastryReading({
    system: parsed.system,
    person1: {
      name: parsed.person1.name,
      placements: placements1,
      birthData: {
        birthDate: parsed.person1.birthDate,
        birthTime: parsed.person1.birthTime,
        timezone: parsed.person1.timezone,
      }
    },
    person2: {
      name: parsed.person2.name,
      placements: placements2,
      birthData: {
        birthDate: parsed.person2.birthDate,
        birthTime: parsed.person2.birthTime,
        timezone: parsed.person2.timezone,
      }
    },
    language: parsed.primaryLanguage || 'en',
  });

  const response = {
    reading,
    metadata: { source, generatedAt: new Date().toISOString() },
  };

  synastryCache.set(cacheKey, response);
  return c.json(response);
});

export const readingsRouter = router;

