import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM - Mouna Dhyana / Forbidden Yoga Classical Style
// Reference: "Day 1 - 001 Mouna Dhyana E.pdf"
//
// Typography:
// - Headers: Sans-serif (Inter) - bold
// - Body: Serif (Lora) - JUSTIFIED like classical books
// - Dedication: Serif (Playfair) - elegant, italicized feel
// - Footer: Sans-serif (Inter) - small, centered
// ═══════════════════════════════════════════════════════════════════════════

// Font paths
function findFontsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../..', 'assets', 'fonts'),
    path.resolve(__dirname, '../../../assets/fonts'),
    path.resolve(process.cwd(), 'assets', 'fonts'),
    '/Users/michaelperinwogenburg/Desktop/1-in-a-billion-app/1-in-a-billion-backend/assets/fonts',
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'Inter_500Medium.ttf'))) {
      return dir;
    }
  }
  return candidates[0];
}

const FONTS_DIR = findFontsDir();
const FONTS = {
  // FORCE GARAMOND EVERYWHERE (User Request)
  interRegular: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  interMedium: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  interSemiBold: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  lora: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  ebGaramond: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  playfair: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
  playfairBold: path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
};

interface ChapterContent {
  title: string;
  system: string;
  person1Reading?: string;
  person2Reading?: string;
  overlayReading?: string;
  verdict?: string;
}

interface PDFGenerationOptions {
  type: 'single' | 'overlay' | 'nuclear';
  title: string;
  subtitle?: string;
  person1: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string };
  person2?: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string };
  chapters: ChapterContent[];
  generatedAt: Date;
  // Dual-truth compatibility (0.0–10.0). If only one value is supplied, we mirror it.
  spicyScore?: number;
  safeStableScore?: number;
  // Backwards compat: old percent-based score (0–100). If present, we map 75% -> 7.5/10.
  compatibilityScore?: number;
  finalVerdict?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF GENERATOR - Mouna Dhyana Classical Book Style
// ═══════════════════════════════════════════════════════════════════════════


function normalizeToTen(value: number): number {
  // If value looks like a percent (e.g. 75), map to /10 (7.5)
  if (value > 10) return value / 10;
  return value;
}

export async function generateReadingPDF(options: PDFGenerationOptions): Promise<{
  filePath: string;
  pageCount: number;
}> {
  const outputDir = path.resolve(__dirname, '../../../generated-pdfs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filename = `${slugify(options.title)}-${Date.now()}.pdf`;
  const filePath = path.join(outputDir, filename);

  return new Promise((resolve, reject) => {
    try {
      // ============================================================
      // 6×9 US TRADE PAPERBACK (publisher-style)
      // ============================================================
      // PDFKit uses points: 72pt = 1 inch
      // 6×9 inches => 432×648 points
      const PAGE = { width: 6 * 72, height: 9 * 72 };
      // Book-ish margins (slightly larger inner/gutter)
      const MARGINS = {
        top: 0.75 * 72,      // 54pt
        bottom: 0.85 * 72,   // 61.2pt
        inner: 1.0 * 72,     // 72pt
        outer: 0.75 * 72,    // 54pt
      };

      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        margins: {
          top: MARGINS.top,
          bottom: MARGINS.bottom,
          left: MARGINS.inner,
          right: MARGINS.outer,
        },
        autoFirstPage: true,
      });

      // Register fonts
      if (fs.existsSync(FONTS.interRegular)) doc.registerFont('Inter', FONTS.interRegular);
      if (fs.existsSync(FONTS.interMedium)) doc.registerFont('Inter-Medium', FONTS.interMedium);
      if (fs.existsSync(FONTS.interSemiBold)) doc.registerFont('Inter-SemiBold', FONTS.interSemiBold);
      if (fs.existsSync(FONTS.lora)) doc.registerFont('Lora', FONTS.lora);
      if (fs.existsSync(FONTS.playfair)) doc.registerFont('Playfair', FONTS.playfair);
      if (fs.existsSync(FONTS.playfairBold)) doc.registerFont('Playfair-Bold', FONTS.playfairBold);
      if (fs.existsSync(FONTS.ebGaramond)) doc.registerFont('EBGaramond', FONTS.ebGaramond);

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const contentWidth = doc.page.width - (MARGINS.inner + MARGINS.outer);
      let pageCount = 1;
      let pageNumber = 1;

      const drawRunningFooter = () => {
        doc.save(); // Isolate footer styles
        const prevY = doc.y;
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // Prevent infinite loop triggers by allowing writing in bottom margin

        doc.font('Inter').fontSize(8).fillColor('#777777')
          // Moved footer down slightly to avoid text overlap (using fixed position from bottom)
          .text(String(pageNumber), MARGINS.inner, doc.page.height - 40, {
            width: contentWidth,
            align: 'center',
            lineBreak: false,
          });

        doc.page.margins.bottom = oldBottomMargin; // Restore margin
        doc.y = prevY;
        doc.restore(); // Restore body styles

        // CRITICAL: doc.save()/restore() do NOT restore font/fontSize/fillColor
        // Explicitly reset to body text defaults to prevent style leakage
        doc.font('EBGaramond').fontSize(10).fillColor('#000000');
      };

      doc.on('pageAdded', () => {
        pageCount++;
        pageNumber++;
        drawRunningFooter();
      });

      // Draw footer for first page
      drawRunningFooter();

      // ─────────────────────────────────────────────────────────────────────
      // PAGE HEADER - "Day 1" style (top left, bold sans-serif)
      // ─────────────────────────────────────────────────────────────────────

      doc.font('Inter-SemiBold').fontSize(10).fillColor('#000000')
        .text('1 in a Billion', MARGINS.inner, MARGINS.top);

      doc.moveDown(2);

      // ─────────────────────────────────────────────────────────────────────
      // TITLE - Centered, bold (like "The 365 days - the Andhakaara path to power")
      // ─────────────────────────────────────────────────────────────────────

      doc.font('Inter-SemiBold').fontSize(12).fillColor('#000000')
        .text(options.title, { align: 'center' });

      doc.moveDown(2);

      // ─────────────────────────────────────────────────────────────────────
      // DEDICATION/EPIGRAPH - Elegant serif, italicized feel, JUSTIFIED
      // (Like "The 365 days - the Andhakaara path to power is dedicated...")
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────────
      // DEDICATION/EPIGRAPH - REMOVED PER USER REQUEST
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────────
      // PERSON INFO - Section title style (like "Mouna Dhyana")
      // ─────────────────────────────────────────────────────────────────────

      doc.font('Inter-SemiBold').fontSize(11).fillColor('#000000')
        .text(options.person1.name);
      doc.moveDown(0.5);

      // Short info lines (like "To learn to listen properly.")
      doc.font('EBGaramond').fontSize(10).fillColor('#000000')
        .text(`Born ${options.person1.birthDate}`);

      if (options.person1.sunSign) {
        doc.font('EBGaramond').fontSize(9).fillColor('#444444')
          .text(`Sun in ${options.person1.sunSign} · Moon in ${options.person1.moonSign || '—'} · Rising ${options.person1.risingSign || '—'}`);
      }

      if (options.person2) {
        doc.moveDown(1.5);
        doc.font('Inter-SemiBold').fontSize(11).fillColor('#000000')
          .text(options.person2.name);
        doc.moveDown(0.5);
        doc.font('EBGaramond').fontSize(10).fillColor('#000000')
          .text(`Born ${options.person2.birthDate}`);
        if (options.person2.sunSign) {
          doc.font('EBGaramond').fontSize(9).fillColor('#444444')
            .text(`Sun in ${options.person2.sunSign} · Moon in ${options.person2.moonSign || '—'} · Rising ${options.person2.risingSign || '—'}`);
        }
      }


      // Compatibility score
      const spicy = options.spicyScore !== undefined ? options.spicyScore
        : (options.compatibilityScore !== undefined ? normalizeToTen(options.compatibilityScore) : undefined);
      const safeStable = options.safeStableScore !== undefined ? options.safeStableScore
        : (options.compatibilityScore !== undefined ? normalizeToTen(options.compatibilityScore) : undefined);

      if (spicy !== undefined && safeStable !== undefined) {
        doc.moveDown(2);
        doc.font('Playfair-Bold').fontSize(32).fillColor('#000000')
          .text(`${spicy.toFixed(1)}/10`, { align: 'center' });
        doc.font('Inter').fontSize(9).fillColor('#666666')
          .text('Spicy', { align: 'center' });
        doc.moveDown(0.75);
        doc.font('Playfair-Bold').fontSize(20).fillColor('#000000')
          .text(`${safeStable.toFixed(1)}/10`, { align: 'center' });
        doc.font('Inter').fontSize(9).fillColor('#666666')
          .text('Safe & Stable', { align: 'center' });
      }


      if (options.compatibilityScore !== undefined) {
        doc.moveDown(2);
        doc.font('Playfair-Bold').fontSize(36).fillColor('#000000')
          .text(`${normalizeToTen(options.compatibilityScore).toFixed(1)}/10`, { align: 'center' });
        doc.font('Inter').fontSize(9).fillColor('#666666')
          .text('Compatibility (legacy)', { align: 'center' });
      }

      doc.moveDown(2);

      // ─────────────────────────────────────────────────────────────────────
      // CHAPTERS - Classical book body text style
      // ─────────────────────────────────────────────────────────────────────

      for (let i = 0; i < options.chapters.length; i++) {
        const chapter = options.chapters[i];

        // Chapter/Section title (like "Mouna Dhyana")
        doc.font('Inter-SemiBold').fontSize(10.5).fillColor('#000000')
          .text(chapter.title);
        doc.moveDown(1);

        // Person 1 reading
        if (chapter.person1Reading) {
          // Body text - book paragraphs (first-line indent, justified)
          const paragraphs = chapter.person1Reading
            .split(/\n\s*\n/g)
            .map((p) => p.trim())
            .filter(Boolean);

          doc.font('EBGaramond').fontSize(10).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(`    ${p}`, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.6);
          }
          doc.moveDown(1.5);
        }

        // Person 2 reading
        if (chapter.person2Reading && options.person2) {
          doc.font('Inter-SemiBold').fontSize(10).fillColor('#000000')
            .text(options.person2.name);
          doc.moveDown(0.5);

          const paragraphs = chapter.person2Reading
            .split(/\n\s*\n/g)
            .map((p) => p.trim())
            .filter(Boolean);

          doc.font('EBGaramond').fontSize(10).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(`    ${p}`, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.6);
          }
          doc.moveDown(1.5);
        }

        // Overlay reading
        if (chapter.overlayReading) {
          doc.font('Inter-SemiBold').fontSize(10).fillColor('#000000')
            .text('The Space Between');
          doc.moveDown(0.5);

          const paragraphs = chapter.overlayReading
            .split(/\n\s*\n/g)
            .map((p) => p.trim())
            .filter(Boolean);

          doc.font('EBGaramond').fontSize(10).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(`    ${p}`, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.6);
          }
          doc.moveDown(1.5);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // FINAL VERDICT
      // ─────────────────────────────────────────────────────────────────────

      if (options.finalVerdict) {
        doc.font('Inter-SemiBold').fontSize(11).fillColor('#000000')
          .text('Final Verdict');
        doc.moveDown(1);

        if (options.compatibilityScore !== undefined) {
          doc.font('Playfair-Bold').fontSize(28).fillColor('#000000')
            .text(`${normalizeToTen(options.compatibilityScore).toFixed(1)}/10`, { align: 'center' });
          doc.moveDown(1);
        }

        doc.font('EBGaramond').fontSize(10).fillColor('#000000')
          .text(options.finalVerdict, {
            align: 'justify',
            lineGap: 4,
          });
      }

      // ─────────────────────────────────────────────────────────────────────
      // FOOTER - Simple centered (like "© forbidden-yoga.com")
      // ─────────────────────────────────────────────────────────────────────

      doc.moveDown(3);
      doc.font('Inter').fontSize(9).fillColor('#888888')
        .text('· · ·', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Inter').fontSize(8).fillColor('#888888')
        .text('This reading is for contemplation and self-discovery.', { align: 'center' });
      doc.font('Inter').fontSize(8).fillColor('#888888')
        .text(`Swiss Ephemeris · ${options.generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
      doc.moveDown(1);
      doc.font('Inter').fontSize(9).fillColor('#666666')
        .text('© 1 in a Billion', { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        console.log(`✅ PDF generated: ${filePath} (${pageCount} pages)`);
        resolve({ filePath, pageCount });
      });

      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function generateChapterPDF(
  chapterNumber: number,
  chapter: ChapterContent,
  person1: PDFGenerationOptions['person1'],
  person2?: PDFGenerationOptions['person2']
): Promise<{ filePath: string; pageCount: number }> {
  return generateReadingPDF({
    type: person2 ? 'overlay' : 'single',
    title: `Chapter ${chapterNumber}: ${chapter.title}`,
    person1,
    person2,
    chapters: [chapter],
    generatedAt: new Date(),
  });
}
