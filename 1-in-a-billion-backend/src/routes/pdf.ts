import { Hono } from 'hono';
import { z } from 'zod';
import { generateReadingPDF, generateChapterPDF } from '../services/pdf/pdfGenerator';
import fs from 'fs';

const router = new Hono();

// Schema for single/overlay PDF
const pdfPayloadSchema = z.object({
  type: z.enum(['single', 'overlay', 'nuclear']),
  title: z.string(),
  subtitle: z.string().optional(),
  person1: z.object({
    name: z.string(),
    birthDate: z.string(),
    sunSign: z.string().optional(),
    moonSign: z.string().optional(),
    risingSign: z.string().optional(),
    portraitUrl: z.string().url().optional(),
  }),
  person2: z.object({
    name: z.string(),
    birthDate: z.string(),
    sunSign: z.string().optional(),
    moonSign: z.string().optional(),
    risingSign: z.string().optional(),
    portraitUrl: z.string().url().optional(),
  }).optional(),
  coupleImageUrl: z.string().url().optional(),
  chapters: z.array(z.object({
    title: z.string(),
    system: z.string(),
    person1Reading: z.string().optional(),
    person2Reading: z.string().optional(),
    overlayReading: z.string().optional(),
    verdict: z.string().optional(),
    conditions: z.array(z.string()).optional(),
  })),
  compatibilityScore: z.number().optional(),
  finalVerdict: z.string().optional(),
});

// Schema for single chapter PDF
const chapterPdfSchema = z.object({
  chapterNumber: z.number(),
  chapter: z.object({
    title: z.string(),
    system: z.string(),
    person1Reading: z.string().optional(),
    person2Reading: z.string().optional(),
    overlayReading: z.string().optional(),
    verdict: z.string().optional(),
  }),
  person1: z.object({
    name: z.string(),
    birthDate: z.string(),
    sunSign: z.string().optional(),
    moonSign: z.string().optional(),
    risingSign: z.string().optional(),
    portraitUrl: z.string().url().optional(),
  }),
  person2: z.object({
    name: z.string(),
    birthDate: z.string(),
    sunSign: z.string().optional(),
    moonSign: z.string().optional(),
    risingSign: z.string().optional(),
    portraitUrl: z.string().url().optional(),
  }).optional(),
  coupleImageUrl: z.string().url().optional(),
});

/**
 * Generate a complete PDF reading
 * POST /api/pdf/generate
 */
router.post('/generate', async (c) => {
  try {
    const payload = pdfPayloadSchema.parse(await c.req.json());
    
    console.log(`📄 PDF generation: ${payload.title} (${payload.chapters.length} chapters)`);
    
    const result = await generateReadingPDF({
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
    } as any);
    
    console.log(`✅ PDF generated: ${result.filePath} (${result.pageCount} pages)`);
    
    return c.json({
      success: true,
      filePath: result.filePath,
      pageCount: result.pageCount,
      // Return downloadable URL (would be served via static route in production)
      downloadUrl: `/api/pdf/download/${encodeURIComponent(result.filePath.split('/').pop() || '')}`,
    });
  } catch (error: any) {
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
    
    const result = await generateChapterPDF(
      payload.chapterNumber,
      {
        title: payload.chapter.title,
        system: payload.chapter.system,
        person1Reading: payload.chapter.person1Reading,
        person2Reading: payload.chapter.person2Reading,
        overlayReading: payload.chapter.overlayReading,
        verdict: payload.chapter.verdict,
      } as any,
      payload.person1 as any,
      payload.person2 as any,
      payload.coupleImageUrl
    );
    
    console.log(`✅ Chapter PDF generated: ${result.filePath}`);
    
    return c.json({
      success: true,
      filePath: result.filePath,
      pageCount: result.pageCount,
      downloadUrl: `/api/pdf/download/${encodeURIComponent(result.filePath.split('/').pop() || '')}`,
    });
  } catch (error: any) {
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
router.get('/download/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = `./generated-pdfs/${filename}`;
  
  if (!fs.existsSync(filePath)) {
    return c.json({ error: 'PDF not found' }, 404);
  }
  
  const file = fs.readFileSync(filePath);
  
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
router.get('/list', async (c) => {
  const pdfDir = './generated-pdfs';
  
  if (!fs.existsSync(pdfDir)) {
    return c.json({ files: [] });
  }
  
  const files = fs.readdirSync(pdfDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
      filename: f,
      downloadUrl: `/api/pdf/download/${encodeURIComponent(f)}`,
      createdAt: fs.statSync(`${pdfDir}/${f}`).mtime,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  return c.json({ files });
});

export const pdfRouter = router;
