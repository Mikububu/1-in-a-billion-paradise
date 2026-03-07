"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfRouter = void 0;
const hono_1 = require("hono");
const zod_1 = require("zod");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const requireAuth_1 = require("../middleware/requireAuth");
const router = new hono_1.Hono();
// Schema for single/overlay PDF
const pdfPayloadSchema = zod_1.z.object({
    type: zod_1.z.enum(['single', 'overlay', 'nuclear']),
    title: zod_1.z.string(),
    subtitle: zod_1.z.string().optional(),
    person1: zod_1.z.object({
        name: zod_1.z.string(),
        birthDate: zod_1.z.string(),
        sunSign: zod_1.z.string().optional(),
        moonSign: zod_1.z.string().optional(),
        risingSign: zod_1.z.string().optional(),
        portraitUrl: zod_1.z.string().url().optional(),
    }),
    person2: zod_1.z.object({
        name: zod_1.z.string(),
        birthDate: zod_1.z.string(),
        sunSign: zod_1.z.string().optional(),
        moonSign: zod_1.z.string().optional(),
        risingSign: zod_1.z.string().optional(),
        portraitUrl: zod_1.z.string().url().optional(),
    }).optional(),
    coupleImageUrl: zod_1.z.string().url().optional(),
    chapters: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        system: zod_1.z.string(),
        person1Reading: zod_1.z.string().optional(),
        person2Reading: zod_1.z.string().optional(),
        overlayReading: zod_1.z.string().optional(),
        verdict: zod_1.z.string().optional(),
        conditions: zod_1.z.array(zod_1.z.string()).optional(),
    })),
    compatibilityScore: zod_1.z.number().optional(),
    finalVerdict: zod_1.z.string().optional(),
});
// Schema for single chapter PDF
const chapterPdfSchema = zod_1.z.object({
    chapterNumber: zod_1.z.number(),
    chapter: zod_1.z.object({
        title: zod_1.z.string(),
        system: zod_1.z.string(),
        person1Reading: zod_1.z.string().optional(),
        person2Reading: zod_1.z.string().optional(),
        overlayReading: zod_1.z.string().optional(),
        verdict: zod_1.z.string().optional(),
    }),
    person1: zod_1.z.object({
        name: zod_1.z.string(),
        birthDate: zod_1.z.string(),
        sunSign: zod_1.z.string().optional(),
        moonSign: zod_1.z.string().optional(),
        risingSign: zod_1.z.string().optional(),
        portraitUrl: zod_1.z.string().url().optional(),
    }),
    person2: zod_1.z.object({
        name: zod_1.z.string(),
        birthDate: zod_1.z.string(),
        sunSign: zod_1.z.string().optional(),
        moonSign: zod_1.z.string().optional(),
        risingSign: zod_1.z.string().optional(),
        portraitUrl: zod_1.z.string().url().optional(),
    }).optional(),
    coupleImageUrl: zod_1.z.string().url().optional(),
});
/**
 * Generate a complete PDF reading
 * POST /api/pdf/generate
 */
router.post('/generate', async (c) => {
    try {
        const payload = pdfPayloadSchema.parse(await c.req.json());
        console.log(`📄 PDF generation: ${payload.title} (${payload.chapters.length} chapters)`);
        const result = await (0, pdfGenerator_1.generateReadingPDF)({
            type: payload.type,
            title: payload.title,
            subtitle: payload.subtitle,
            person1: payload.person1,
            person2: payload.person2,
            coupleImageUrl: payload.coupleImageUrl,
            chapters: payload.chapters.map(ch => ({
                title: ch.title,
                system: ch.system,
                person1Reading: ch.person1Reading,
                person2Reading: ch.person2Reading,
                overlayReading: ch.overlayReading,
                verdict: ch.verdict,
            })),
            generatedAt: new Date(),
            compatibilityScore: payload.compatibilityScore,
            finalVerdict: payload.finalVerdict,
        });
        console.log(`✅ PDF generated: ${result.filePath} (${result.pageCount} pages)`);
        return c.json({
            success: true,
            filePath: result.filePath,
            pageCount: result.pageCount,
            // Return downloadable URL (would be served via static route in production)
            downloadUrl: `/api/pdf/download/${encodeURIComponent(result.filePath.split('/').pop() || '')}`,
        });
    }
    catch (error) {
        console.error('❌ PDF generation failed:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});
/**
 * Generate a single chapter PDF (for progressive generation)
 * POST /api/pdf/generate-chapter
 */
router.post('/generate-chapter', async (c) => {
    try {
        const payload = chapterPdfSchema.parse(await c.req.json());
        console.log(`📄 Chapter PDF: Chapter ${payload.chapterNumber} - ${payload.chapter.title}`);
        const result = await (0, pdfGenerator_1.generateChapterPDF)(payload.chapterNumber, {
            title: payload.chapter.title,
            system: payload.chapter.system,
            person1Reading: payload.chapter.person1Reading,
            person2Reading: payload.chapter.person2Reading,
            overlayReading: payload.chapter.overlayReading,
            verdict: payload.chapter.verdict,
        }, payload.person1, payload.person2, payload.coupleImageUrl);
        console.log(`✅ Chapter PDF generated: ${result.filePath}`);
        return c.json({
            success: true,
            filePath: result.filePath,
            pageCount: result.pageCount,
            downloadUrl: `/api/pdf/download/${encodeURIComponent(result.filePath.split('/').pop() || '')}`,
        });
    }
    catch (error) {
        console.error('❌ Chapter PDF generation failed:', error);
        return c.json({
            success: false,
            error: error.message
        }, 500);
    }
});
/**
 * Download a generated PDF
 * GET /api/pdf/download/:filename
 */
router.get('/download/:filename', requireAuth_1.requireAuth, async (c) => {
    const filename = c.req.param('filename');
    const PDF_DIR = './generated-pdfs';
    const resolved = path_1.default.resolve(PDF_DIR, filename);
    if (!resolved.startsWith(path_1.default.resolve(PDF_DIR))) {
        return c.json({ error: 'Invalid filename' }, 400);
    }
    const filePath = resolved;
    if (!fs_1.default.existsSync(filePath)) {
        return c.json({ error: 'PDF not found' }, 404);
    }
    const file = fs_1.default.readFileSync(filePath);
    return new Response(file, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
});
/**
 * List generated PDFs
 * GET /api/pdf/list
 */
router.get('/list', requireAuth_1.requireAuth, async (c) => {
    const pdfDir = './generated-pdfs';
    if (!fs_1.default.existsSync(pdfDir)) {
        return c.json({ files: [] });
    }
    const files = fs_1.default.readdirSync(pdfDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => ({
        filename: f,
        downloadUrl: `/api/pdf/download/${encodeURIComponent(f)}`,
        createdAt: fs_1.default.statSync(`${pdfDir}/${f}`).mtime,
    }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return c.json({ files });
});
exports.pdfRouter = router;
//# sourceMappingURL=pdf.js.map