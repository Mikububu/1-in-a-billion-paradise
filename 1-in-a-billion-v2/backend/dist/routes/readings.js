"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readingsRouter = void 0;
const hono_1 = require("hono");
const zod_1 = require("zod");
const swissEphemeris_1 = require("../services/swissEphemeris");
const readingsClient_1 = require("../services/text/readingsClient");
const cache_1 = require("../services/cache");
const requireAuth_1 = require("../middleware/requireAuth");
const logger_1 = require("../utils/logger");
const payloadSchema = zod_1.z.object({
    birthDate: zod_1.z.string().max(100),
    birthTime: zod_1.z.string().max(100),
    timezone: zod_1.z.string().max(100),
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    birthPlace: zod_1.z.string().max(200).optional(), // City name for poetic intro
    relationshipIntensity: zod_1.z.number().min(0).max(10),
    relationshipMode: zod_1.z.enum(['family', 'sensual']),
    primaryLanguage: zod_1.z.string().max(100),
    secondaryLanguage: zod_1.z.string().max(100).optional(),
    subjectName: zod_1.z.string().max(200).optional(),
    isPartnerReading: zod_1.z.boolean().optional(),
});
const sunCache = new cache_1.ResponseCache();
const moonCache = new cache_1.ResponseCache();
const risingCache = new cache_1.ResponseCache();
const buildResponse = (reading, placements, cacheHit, source) => ({
    reading,
    placements,
    metadata: {
        cacheHit,
        generatedAt: new Date().toISOString(),
        source,
    },
});
const router = new hono_1.Hono();
/**
 * Auto-correct timezone if UTC is sent but coordinates are far from GMT.
 * Uses Google Timezone API as a safety net.
 */
async function correctTimezoneIfNeeded(timezone, latitude, longitude, label) {
    if (timezone !== 'UTC')
        return timezone;
    const expectedOffset = Math.round(longitude / 15);
    if (Math.abs(expectedOffset) <= 1)
        return timezone;
    logger_1.logger.error(`[${label}] TIMEZONE BUG DETECTED! Timezone is UTC but coordinates suggest offset`, {
        timezone, longitude,
        expectedOffset: `UTC${expectedOffset >= 0 ? '+' : ''}${expectedOffset}`,
        coordinates: `${latitude}, ${longitude}`,
    });
    try {
        const { getApiKey } = await Promise.resolve().then(() => __importStar(require('../services/apiKeys')));
        const googleKey = await getApiKey('google_places');
        if (googleKey) {
            const timestamp = Math.floor(Date.now() / 1000);
            const tzUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${googleKey}`;
            const tzResponse = await fetch(tzUrl);
            const tzData = await tzResponse.json();
            if (tzData.status === 'OK' && tzData.timeZoneId) {
                logger_1.logger.info(`[${label}] AUTO-CORRECTED timezone: UTC -> ${tzData.timeZoneId}`);
                return tzData.timeZoneId;
            }
        }
    }
    catch (tzErr) {
        logger_1.logger.warn(`[${label}] Failed to auto-correct timezone`, { error: String(tzErr) });
    }
    return timezone;
}
// Placements endpoint (Swiss Ephemeris only)
// Used by mobile to compute Sun/Moon/Rising immediately after saving a person.
const placementsSchema = zod_1.z.object({
    birthDate: zod_1.z.string().max(100),
    birthTime: zod_1.z.string().max(100),
    timezone: zod_1.z.string().max(100),
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    system: zod_1.z.enum(['western', 'vedic']).optional().default('western'),
});
router.post('/placements', requireAuth_1.requireAuth, async (c) => {
    const parsed = placementsSchema.parse(await c.req.json());
    // DEBUG: Log incoming data for troubleshooting
    logger_1.logger.info('[Placements] Incoming request', {
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
        logger_1.logger.error('[Placements] Invalid coordinates (0,0) - birth location missing!');
        return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
    }
    // Swiss engine expects a ReadingPayload; provide safe defaults for non-reading fields.
    const placements = await swissEphemeris_1.swissEngine.computePlacements({
        birthDate: parsed.birthDate,
        birthTime: parsed.birthTime,
        timezone: correctedTimezone, // Use corrected timezone (auto-fixed if UTC bug detected)
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        relationshipIntensity: 5,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
    });
    // If vedic requested, return sidereal signs in the top-level fields
    // so the mobile client can use a single normalize function.
    if (parsed.system === 'vedic' && placements?.sidereal) {
        const sid = placements.sidereal;
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
router.post('/sun', requireAuth_1.requireAuth, async (c) => {
    const parsed = payloadSchema.parse(await c.req.json());
    const nocache = c.req.query('nocache') === 'true';
    // DEBUG: Log incoming data
    logger_1.logger.info('[Sun] Incoming request', {
        birthDate: parsed.birthDate,
        birthTime: parsed.birthTime,
        timezone: parsed.timezone,
        lat: parsed.latitude,
        lng: parsed.longitude,
        nocache,
    });
    // VALIDATION: Reject invalid coordinates
    if (parsed.latitude === 0 && parsed.longitude === 0) {
        logger_1.logger.error('[Sun] Invalid coordinates (0,0) - birth location missing!');
        return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
    }
    // Auto-correct timezone if needed
    const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Sun');
    const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;
    const cacheKey = JSON.stringify({ type: 'sun', parsed: correctedParsed });
    if (!nocache) {
        const cached = sunCache.get(cacheKey);
        if (cached) {
            logger_1.logger.info('[Sun] Returning CACHED reading');
            return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
        }
    }
    else {
        logger_1.logger.info('[Sun] NOCACHE mode - bypassing cache, generating fresh reading');
    }
    const placements = await swissEphemeris_1.swissEngine.computePlacements(correctedParsed);
    const { reading, source } = await readingsClient_1.readingsClient.generateHookReading({
        type: 'sun',
        sign: placements.sunSign,
        payload: parsed,
        placements, // Pass full placements with degrees!
    });
    const response = buildResponse(reading, placements, false, source);
    sunCache.set(cacheKey, response);
    return c.json(response);
});
router.post('/moon', requireAuth_1.requireAuth, async (c) => {
    const parsed = payloadSchema.parse(await c.req.json());
    const nocache = c.req.query('nocache') === 'true';
    // DEBUG: Log incoming data
    logger_1.logger.info('[Moon] Incoming request', {
        birthDate: parsed.birthDate,
        birthTime: parsed.birthTime,
        timezone: parsed.timezone,
        lat: parsed.latitude,
        lng: parsed.longitude,
        nocache,
    });
    // VALIDATION: Reject invalid coordinates
    if (parsed.latitude === 0 && parsed.longitude === 0) {
        logger_1.logger.error('[Moon] Invalid coordinates (0,0) - birth location missing!');
        return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
    }
    // Auto-correct timezone if needed
    const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Moon');
    const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;
    const cacheKey = JSON.stringify({ type: 'moon', parsed: correctedParsed });
    if (!nocache) {
        const cached = moonCache.get(cacheKey);
        if (cached) {
            logger_1.logger.info('[Moon] Returning CACHED reading');
            return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
        }
    }
    else {
        logger_1.logger.info('[Moon] NOCACHE mode - bypassing cache, generating fresh reading');
    }
    const placements = await swissEphemeris_1.swissEngine.computePlacements(correctedParsed);
    const { reading, source } = await readingsClient_1.readingsClient.generateHookReading({
        type: 'moon',
        sign: placements.moonSign,
        payload: parsed,
        placements, // Pass full placements with degrees!
    });
    const response = buildResponse(reading, placements, false, source);
    moonCache.set(cacheKey, response);
    return c.json(response);
});
router.post('/rising', requireAuth_1.requireAuth, async (c) => {
    const parsed = payloadSchema.parse(await c.req.json());
    const nocache = c.req.query('nocache') === 'true';
    // DEBUG: Log incoming data
    logger_1.logger.info('[Rising] Incoming request', {
        birthDate: parsed.birthDate,
        birthTime: parsed.birthTime,
        timezone: parsed.timezone,
        lat: parsed.latitude,
        lng: parsed.longitude,
        nocache,
    });
    // VALIDATION: Reject invalid coordinates
    if (parsed.latitude === 0 && parsed.longitude === 0) {
        logger_1.logger.error('[Rising] Invalid coordinates (0,0) - birth location missing!');
        return c.json({ error: 'Invalid birth location - coordinates are 0,0' }, 400);
    }
    // Auto-correct timezone if needed
    const correctedTimezone = await correctTimezoneIfNeeded(parsed.timezone, parsed.latitude, parsed.longitude, 'Rising');
    const correctedParsed = correctedTimezone !== parsed.timezone ? { ...parsed, timezone: correctedTimezone } : parsed;
    const cacheKey = JSON.stringify({ type: 'rising', parsed: correctedParsed });
    if (!nocache) {
        const cached = risingCache.get(cacheKey);
        if (cached) {
            logger_1.logger.info('[Rising] Returning CACHED reading');
            return c.json({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
        }
    }
    else {
        logger_1.logger.info('[Rising] NOCACHE mode - bypassing cache, generating fresh reading');
    }
    const placements = await swissEphemeris_1.swissEngine.computePlacements(correctedParsed);
    const { reading, source } = await readingsClient_1.readingsClient.generateHookReading({
        type: 'rising',
        sign: placements.risingSign,
        payload: parsed,
        placements, // Pass full placements with degrees!
    });
    const response = buildResponse(reading, placements, false, source);
    risingCache.set(cacheKey, response);
    return c.json(response);
});
exports.readingsRouter = router;
//# sourceMappingURL=readings.js.map