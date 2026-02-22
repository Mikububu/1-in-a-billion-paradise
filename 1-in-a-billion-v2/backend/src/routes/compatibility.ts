import { Hono } from 'hono';
import { z } from 'zod';
import { swissEngine } from '../services/swissEphemeris';
import { llm } from '../services/llm';
import { ResponseCache } from '../services/cache';

const compatibilitySchema = z.object({
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
});

const compatibilityCache = new ResponseCache<any>();

const router = new Hono();

router.post('/calculate', async (c) => {
  const body = await c.req.json();
  const parsed = compatibilitySchema.parse(body);
  const cacheKey = JSON.stringify({ type: 'compatibility_scores', parsed });
  const cached = compatibilityCache.get(cacheKey);
  if (cached) return c.json(cached);

  // Get placements for both people using Swiss Ephemeris
  const placements1 = await swissEngine.computePlacements({
    birthDate: parsed.person1.birthDate,
    birthTime: parsed.person1.birthTime,
    timezone: parsed.person1.timezone,
    latitude: parsed.person1.latitude,
    longitude: parsed.person1.longitude,
    relationshipIntensity: 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  const placements2 = await swissEngine.computePlacements({
    birthDate: parsed.person2.birthDate,
    birthTime: parsed.person2.birthTime,
    timezone: parsed.person2.timezone,
    latitude: parsed.person2.latitude,
    longitude: parsed.person2.longitude,
    relationshipIntensity: 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  // Build prompt for LLM to calculate dual compatibility scores
  const prompt = `You are an expert astrologer analyzing compatibility between two people using Western astrology.

PERSON 1 (${parsed.person1.name}):
- Sun: ${placements1.sunSign} ${placements1.sunDegree?.degree || 0}°${placements1.sunDegree?.minute || 0}'
- Moon: ${placements1.moonSign} ${placements1.moonDegree?.degree || 0}°${placements1.moonDegree?.minute || 0}'
- Rising: ${placements1.risingSign} ${placements1.ascendantDegree?.degree || 0}°${placements1.ascendantDegree?.minute || 0}'

PERSON 2 (${parsed.person2.name}):
- Sun: ${placements2.sunSign} ${placements2.sunDegree?.degree || 0}°${placements2.sunDegree?.minute || 0}'
- Moon: ${placements2.moonSign} ${placements2.moonDegree?.degree || 0}°${placements2.moonDegree?.minute || 0}'
- Rising: ${placements2.risingSign} ${placements2.ascendantDegree?.degree || 0}°${placements2.ascendantDegree?.minute || 0}'

Calculate TWO compatibility scores (scale 1-10, with decimals):

1. **Spicy Score**: Passion, excitement, sexual chemistry, intensity, challenge, growth through conflict. Consider Sun-Moon passion, fire/water energy, Rising sign chemistry.

2. **Safe & Stable Score**: Emotional security, reliability, trust, comfort, ease, long-term stability. Consider Moon-Moon harmony, earth/water grounding, Rising sign compatibility.

IMPORTANT: 
- These scores should be DIFFERENT from each other
- A couple can be high spicy but low stable (exciting but unstable)
- A couple can be high stable but low spicy (comfortable but boring)
- Use actual planetary positions and aspects to calculate
- Be realistic - not all couples are 6.5/10 on everything

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{"spicyScore": 7.8, "safeStableScore": 5.2}`;

  // Call LLM to calculate scores
  const response = await llm.generate(prompt, 'compatibility_scores', {
    maxTokens: 100,
    temperature: 0.3,
  });

  // Parse the JSON response
  let scores;
  try {
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      scores = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    console.error('Failed to parse LLM response:', response);
    // Fallback to random scores if parsing fails
    scores = {
      spicyScore: parseFloat((Math.random() * 4 + 5).toFixed(1)),
      safeStableScore: parseFloat((Math.random() * 4 + 5).toFixed(1)),
    };
  }

  const result = {
    spicyScore: scores.spicyScore,
    safeStableScore: scores.safeStableScore,
    metadata: {
      generatedAt: new Date().toISOString(),
      person1: parsed.person1.name,
      person2: parsed.person2.name,
    },
  };

  compatibilityCache.set(cacheKey, result);
  return c.json(result);
});

export const compatibilityRouter = router;

