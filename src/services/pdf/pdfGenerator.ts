import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { PDF_CONFIG, fontSize, color } from '../../config/pdfConfig';

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
  // USE LORA - Better unicode support for special characters
  interRegular: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  interMedium: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  interSemiBold: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  lora: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  ebGaramond: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  playfair: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
  playfairBold: path.join(FONTS_DIR, 'Lora_400Regular.ttf'),
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
  person1: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  person2?: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  coupleImageUrl?: string;
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

function normalizeWhitespace(s: string): string {
  // Fix weird spacing coming from stored artifacts (including multiple spaces / tabs / newlines)
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function stripLeadingMarkdownMarkers(line: string): string {
  // Keep content but remove common markdown markers that should not show in PDFs.
  return line
    .replace(/^#{1,6}\s+/g, '')
    .replace(/^[-*]\s+/g, '')
    .trim();
}

function toParagraphs(raw: string): string[] {
  const cleaned = raw.replace(/\r\n/g, '\n');
  return cleaned
    .split(/\n\s*\n/g)
    .map((p) =>
      normalizeWhitespace(
        p
          .split('\n')
          .map(stripLeadingMarkdownMarkers)
          .join(' ')
      )
    )
    .filter(Boolean);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export async function generateReadingPDF(options: PDFGenerationOptions): Promise<{
  filePath: string;
  pageCount: number;
}> {
  const outputDir = path.resolve(__dirname, '../../../generated-pdfs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filename = `${slugify(options.title)}-${Date.now()}.pdf`;
  const filePath = path.join(outputDir, filename);

  // Best-effort: preload portrait/couple images (so PDFs can embed them reliably)
  const [person1PortraitBuf, person2PortraitBuf, couplePortraitBuf] = await Promise.all([
    options.person1.portraitUrl ? fetchImageBuffer(options.person1.portraitUrl) : Promise.resolve(null),
    options.person2?.portraitUrl ? fetchImageBuffer(options.person2.portraitUrl) : Promise.resolve(null),
    options.coupleImageUrl ? fetchImageBuffer(options.coupleImageUrl) : Promise.resolve(null),
  ]);

  return new Promise((resolve, reject) => {
    try {
      // Use centralized margins (keeps room for multi-line footer)
      // Note: page size is still 6×9 here; we are first fixing the "giant gaps"
      // caused by justification and multiple spaces in generated text.
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
        doc.font('EBGaramond').fontSize(9.5).fillColor('#000000');
      };

      doc.on('pageAdded', () => {
        pageCount++;
        pageNumber++;
        drawRunningFooter();
      });

      // Draw footer for first page
      drawRunningFooter();

      // ─────────────────────────────────────────────────────────────────────
      // PAGE HEADER - Centered "1 in a Billion" (similar to app screen 1)
      // ─────────────────────────────────────────────────────────────────────

      doc.font('Inter-SemiBold').fontSize(16).fillColor('#000000')
        .text('1 in a Billion', { align: 'center' });

      doc.moveDown(1);

      // ─────────────────────────────────────────────────────────────────────
      // DATE - Centered below brand name (NO "Swiss Ephemeris" text)
      // ─────────────────────────────────────────────────────────────────────

      const formattedDate = options.generatedAt.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.font('Inter').fontSize(9).fillColor('#666666')
        .text(formattedDate, { align: 'center' });

      doc.moveDown(2);

      // ─────────────────────────────────────────────────────────────────────
      // TITLE - System + Person name (centered)
      // ─────────────────────────────────────────────────────────────────────

      doc.font('Inter-SemiBold').fontSize(12).fillColor('#000000')
        .text(options.title, { align: 'center' });

      doc.moveDown(3);

      // ─────────────────────────────────────────────────────────────────────
      // DEDICATION/EPIGRAPH - Elegant serif, italicized feel, JUSTIFIED
      // (Like "The 365 days - the Andhakaara path to power is dedicated...")
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────────
      // DEDICATION/EPIGRAPH - REMOVED PER USER REQUEST
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────────
      // PERSON INFO - Profile-style layout (image middle-left, data right)
      // ─────────────────────────────────────────────────────────────────────

      // Portrait/couple image on the LEFT side (profile-style layout)
      const imageGap = 20;
      const portraitH = 100;
      const portraitW = couplePortraitBuf ? 160 : 100;
      const imageX = MARGINS.inner;
      const infoStartY = doc.y;
      const textStartX = imageX + portraitW + imageGap;
      const textWidth = contentWidth - (portraitW + imageGap);

      if (couplePortraitBuf) {
        try {
          doc.image(couplePortraitBuf, imageX, infoStartY, { fit: [portraitW, portraitH] });
        } catch {
          // ignore
        }
      } else if (person1PortraitBuf) {
        try {
          doc.image(person1PortraitBuf, imageX, infoStartY, { fit: [portraitW, portraitH] });
        } catch {
          // ignore
        }
      }

      // Person info text on the RIGHT of image
      doc.font('Inter-SemiBold').fontSize(11).fillColor('#000000')
        .text(options.person1.name, textStartX, infoStartY, { width: textWidth });
      doc.moveDown(0.5);

      // Birth date
      doc.font('EBGaramond').fontSize(9.5).fillColor('#000000')
        .text(`Born ${options.person1.birthDate}`, { width: textWidth });

      if (options.person1.sunSign) {
        doc.font('EBGaramond').fontSize(8.5).fillColor('#444444')
          .text(`Sun in ${options.person1.sunSign} · Moon in ${options.person1.moonSign || '—'} · Rising ${options.person1.risingSign || '—'}`, { width: textWidth });
      }

      if (options.person2) {
        doc.moveDown(1.5);
        // For overlays, if we don't have a couple image, try to render person2 portrait beside person2 info.
        const p2StartY = doc.y;
        if (!couplePortraitBuf && person2PortraitBuf) {
          try {
            doc.image(person2PortraitBuf, imageX, p2StartY, { fit: [portraitW, portraitH] });
          } catch {
            // ignore
          }
        }

        doc.font('Inter-SemiBold').fontSize(10.5).fillColor('#000000')
          .text(options.person2.name, { width: textWidth });
        doc.moveDown(0.5);
        doc.font('EBGaramond').fontSize(9.5).fillColor('#000000')
          .text(`Born ${options.person2.birthDate}`, { width: textWidth });
        if (options.person2.sunSign) {
          doc.font('EBGaramond').fontSize(8.5).fillColor('#444444')
            .text(`Sun in ${options.person2.sunSign} · Moon in ${options.person2.moonSign || '—'} · Rising ${options.person2.risingSign || '—'}`, { width: textWidth });
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
        doc.font('Inter-SemiBold').fontSize(10).fillColor('#000000')
          .text(chapter.title);
        doc.moveDown(1);

        // Person 1 reading
        if (chapter.person1Reading) {
          // IMPORTANT: Avoid `align: 'justify'` because it can create huge gaps between words.
          // Also normalize whitespace so we don't render double-spaces.
          const paragraphs = toParagraphs(chapter.person1Reading);

          doc.font('EBGaramond').fontSize(fontSize('body')).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(p, { align: 'left', lineGap: 3 });
            doc.moveDown(0.6);
          }
          doc.moveDown(1.2);
        }

        // Person 2 reading
        if (chapter.person2Reading && options.person2) {
          doc.font('Inter-SemiBold').fontSize(9.5).fillColor('#000000')
            .text(options.person2.name);
          doc.moveDown(0.5);

          const paragraphs = toParagraphs(chapter.person2Reading);

          doc.font('EBGaramond').fontSize(fontSize('body')).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(p, { align: 'left', lineGap: 3 });
            doc.moveDown(0.6);
          }
          doc.moveDown(1.5);
        }

        // Overlay reading
        if (chapter.overlayReading) {
          doc.font('Inter-SemiBold').fontSize(9.5).fillColor('#000000')
            .text('The Space Between');
          doc.moveDown(0.5);

          const paragraphs = toParagraphs(chapter.overlayReading);

          doc.font('EBGaramond').fontSize(fontSize('body')).fillColor('#000000');
          for (const p of paragraphs) {
            doc.text(p, { align: 'left', lineGap: 3 });
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

        doc.font('EBGaramond').fontSize(fontSize('body')).fillColor('#000000')
          .text(options.finalVerdict, {
            align: 'left',
            lineGap: 3,
          });
      }

      // ─────────────────────────────────────────────────────────────────────
      // FOOTER - Simple centered (like "© forbidden-yoga.com")
      // ─────────────────────────────────────────────────────────────────────

      // Render footer using centralized config (see src/config/pdfConfig.ts)
      renderFooter(doc);

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

/**
 * Render PDF header (first page only) using centralized config
 * 
 * CHANGE HEADER: Edit src/config/pdfConfig.ts header.firstPage
 * Changes apply to ALL PDFs instantly
 */
function renderFirstPageHeader(doc: PDFKit.PDFDocument, generatedDate: Date): void {
  if (!PDF_CONFIG.header.show || !PDF_CONFIG.header.firstPage.showDate) return;

  const { ephemerisCredit, dateFormat } = PDF_CONFIG.header.firstPage;
  const headerFontSize = PDF_CONFIG.header.fontSize;
  const headerColor = PDF_CONFIG.header.color;

  const formattedDate = generatedDate.toLocaleDateString('en-US', dateFormat);
  
  doc.font('Inter').fontSize(headerFontSize).fillColor(headerColor)
    .text(`${ephemerisCredit} ${PDF_CONFIG.header.separator} ${formattedDate}`, { align: 'center' });
  doc.moveDown(1);
}

/**
 * Render PDF footer using centralized config
 * 
 * CHANGE FOOTER: Edit src/config/pdfConfig.ts footer.content
 * Changes apply to ALL PDFs instantly
 */
function renderFooter(doc: PDFKit.PDFDocument): void {
  if (!PDF_CONFIG.footer.show) return;

  const { content } = PDF_CONFIG.footer;
  const footerFontSize = fontSize('footer');
  const footerColor = PDF_CONFIG.footer.color;

  doc.moveDown(3);
  
  // Separator dots
  doc.font('Inter').fontSize(9).fillColor('#888888')
    .text('· · ·', { align: 'center' });
  doc.moveDown(0.5);

  // Disclaimer
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text(content.disclaimer, { align: 'center' });
  
  doc.moveDown(0.5);

  // Website
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text(`Website: ${content.website}`, { align: 'center' });
  
  doc.moveDown(0.5);

  // Publisher
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text('Published by:', { align: 'center' });
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text(content.publisher.name, { align: 'center' });
  doc.font('Inter').fontSize(footerFontSize - 1).fillColor(footerColor)
    .text(content.publisher.address, { align: 'center' });
  
  doc.moveDown(0.5);

  // Powered by
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text(`powered by: ${content.poweredBy}`, { align: 'center' });
  
  // Creator
  doc.font('Inter').fontSize(footerFontSize).fillColor(footerColor)
    .text(`App created by: ${content.creator}`, { align: 'center' });
  
  doc.moveDown(1);
  
  // Copyright
  doc.font('Inter').fontSize(9).fillColor('#666666')
    .text(content.copyright, { align: 'center' });
}

export async function generateChapterPDF(
  chapterNumber: number,
  chapter: ChapterContent,
  person1: PDFGenerationOptions['person1'],
  person2?: PDFGenerationOptions['person2'],
  coupleImageUrl?: string
): Promise<{ filePath: string; pageCount: number }> {
  // Use the chapter title directly (no "Chapter X:" prefix)
  // The title already contains the system name and person name (e.g., "Vedic - Akasha")
  return generateReadingPDF({
    type: person2 ? 'overlay' : 'single',
    title: chapter.title,
    person1,
    person2,
    coupleImageUrl,
    chapters: [chapter],
    generatedAt: new Date(),
  });
}
