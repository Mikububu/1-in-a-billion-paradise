"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesRouter = void 0;
const hono_1 = require("hono");
const zod_1 = require("zod");
const matchEngine_1 = require("../services/matchEngine");
const payloadSchema = zod_1.z.object({
    birthDate: zod_1.z.string(),
    birthTime: zod_1.z.string(),
    timezone: zod_1.z.string(),
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    relationshipIntensity: zod_1.z.number().min(0).max(10),
    relationshipMode: zod_1.z.enum(['family', 'sensual']),
    primaryLanguage: zod_1.z.string(),
    secondaryLanguage: zod_1.z.string().optional(),
});
const detailSchema = payloadSchema.extend({
    matchId: zod_1.z.string(),
});
const router = new hono_1.Hono();
router.post('/preview', async (c) => {
    const parsed = payloadSchema.parse(await c.req.json());
    return c.json(matchEngine_1.matchEngine.getPreview(parsed));
});
router.post('/detail', async (c) => {
    const parsed = detailSchema.parse(await c.req.json());
    return c.json({ match: matchEngine_1.matchEngine.getDetail(parsed.matchId) });
});
exports.matchesRouter = router;
//# sourceMappingURL=matches.js.map