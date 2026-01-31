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

const router = new Hono();

// Placements endpoint (Swiss Ephemeris only)
// Used by mobile to compute Sun/Moon/Rising immediately after saving a person.
const placementsSchema = z.object({
  birthDate: z.string(),
  birthTime: z.string(),
  timezone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  system: z.enum(['western', 'vedic']).optional().default('western'),
});

router.post('/placements', async (c) => {
  const parsed = placementsSchema.parse(await c.req.json());

  // DEBUG: Log incoming data for troubleshooting
  console.log('📍 [Placements] Incoming request:', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    system: parsed.system,
  });

  // CRITICAL WARNING: Detect timezone mismatch
  // If timezone is UTC but coordinates are far from GMT, the user likely has a bug
  let correctedTimezone = parsed.timezone;
  if (parsed.timezone === 'UTC') {
    const expectedOffset = Math.round(parsed.longitude / 15); // Rough timezone estimate
    if (Math.abs(expectedOffset) > 1) {
      console.error('⚠️ [Placements] TIMEZONE BUG DETECTED! Timezone is UTC but coordinates suggest offset:', {
        timezone: parsed.timezone,
        longitude: parsed.longitude,
        expectedOffset: `UTC${expectedOffset >= 0 ? '+' : ''}${expectedOffset}`,
        coordinates: `${parsed.latitude}, ${parsed.longitude}`,
      });
      
      // SAFETY NET: Try to fetch correct timezone from Google Timezone API
      try {
        const { getApiKey } = await import('../services/apiKeys');
        const googleKey = await getApiKey('google_places');
        if (googleKey) {
          const timestamp = Math.floor(Date.now() / 1000);
          const tzUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${parsed.latitude},${parsed.longitude}&timestamp=${timestamp}&key=${googleKey}`;
          const tzResponse = await fetch(tzUrl);
          const tzData = await tzResponse.json();
          if (tzData.status === 'OK' && tzData.timeZoneId) {
            console.log(`✅ [Placements] AUTO-CORRECTED timezone: UTC → ${tzData.timeZoneId}`);
            correctedTimezone = tzData.timeZoneId;
          }
        }
      } catch (tzErr) {
        console.warn('[Placements] Failed to auto-correct timezone:', tzErr);
        // Continue with UTC if correction fails
      }
    }
  }

  // VALIDATION: Reject invalid coordinates (0,0 is in the middle of the ocean)
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    console.error('❌ [Placements] Invalid coordinates (0,0) - birth location missing!');
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

router.post('/sun', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';
  
  // DEBUG: Log incoming data
  console.log('☉ [Sun] Incoming request:', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });
  
  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    console.error('❌ [Sun] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }
  
  const cacheKey = JSON.stringify({ type: 'sun', parsed });
  if (!nocache) {
    const cached = sunCache.get(cacheKey);
    if (cached) {
      console.log('✅ [Sun] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    console.log('🔥 [Sun] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
    type: 'sun', 
    sign: placements.sunSign, 
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, placements as any, false, source);
  sunCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/moon', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';
  
  // DEBUG: Log incoming data
  console.log('☽ [Moon] Incoming request:', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });
  
  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    console.error('❌ [Moon] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }
  
  const cacheKey = JSON.stringify({ type: 'moon', parsed });
  if (!nocache) {
    const cached = moonCache.get(cacheKey);
    if (cached) {
      console.log('✅ [Moon] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    console.log('🔥 [Moon] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
    type: 'moon', 
    sign: placements.moonSign, 
    payload: parsed,
    placements, // Pass full placements with degrees!
  });
  const response = buildResponse(reading, placements as any, false, source);
  moonCache.set(cacheKey, response);
  return c.json(response);
});

router.post('/rising', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const nocache = c.req.query('nocache') === 'true';
  
  // DEBUG: Log incoming data
  console.log('↑ [Rising] Incoming request:', {
    birthDate: parsed.birthDate,
    birthTime: parsed.birthTime,
    timezone: parsed.timezone,
    lat: parsed.latitude,
    lng: parsed.longitude,
    nocache,
  });
  
  // VALIDATION: Reject invalid coordinates
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    console.error('❌ [Rising] Invalid coordinates (0,0) - birth location missing!');
    return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
  }
  
  const cacheKey = JSON.stringify({ type: 'rising', parsed });
  if (!nocache) {
    const cached = risingCache.get(cacheKey);
    if (cached) {
      console.log('✅ [Rising] Returning CACHED reading');
      return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }
  } else {
    console.log('🔥 [Rising] NOCACHE mode - bypassing cache, generating fresh reading');
  }

  const placements = await swissEngine.computePlacements(parsed);
  const { reading, source } = await deepSeekClient.generateHookReading({ 
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

