import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Font path
const FONTS_DIR = path.resolve(__dirname, '../../../assets/fonts');
const GARAMOND = path.join(FONTS_DIR, 'EBGaramond-Regular.ttf');
const PLAYFAIR_BOLD = path.join(FONTS_DIR, 'PlayfairDisplay_700Bold.ttf');

/** Max width/height for embedded images (≈2× A4 display). Keeps PDFs small. */
const PDF_IMAGE_MAX_PX = 800;
const PDF_IMAGE_JPEG_QUALITY = 82;

/**
 * ⚠️ CRITICAL: ChapterContent must have EXACTLY ONE reading field with content
 * 
 * Each PDF should only use ONE of these fields:
 * - person1Reading: For person 1's individual reading ONLY
 * - person2Reading: For person 2's individual reading ONLY
 * - overlayReading: For synastry/compatibility reading ONLY
 * - verdict: For final verdict/summary ONLY
 * 
 * NEVER use the same content for multiple fields or multiple PDFs.
 * See: docs/PDF_CONTENT_ROUTING_RULES.md
 */
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
  coverQuote?: string;
  person1: { name: string; birthDate: string; birthTime?: string; birthPlace?: string; timezone?: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  person2?: { name: string; birthDate: string; birthTime?: string; birthPlace?: string; timezone?: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  coupleImageUrl?: string;
  chapters: ChapterContent[];
  chartReferencePage?: string;
  chartReferencePageRight?: string;
  generatedAt: Date;
  spicyScore?: number;
  safeStableScore?: number;
  compatibilityScore?: number;
  finalVerdict?: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    // Local file support for dev/test runs (absolute paths or file:// URLs)
    if (url.startsWith('file://')) {
      const localPath = new URL(url).pathname;
      if (fs.existsSync(localPath)) {
        return await fs.promises.readFile(localPath);
      }
      return null;
    }

    if (url.startsWith('/') && fs.existsSync(url)) {
      return await fs.promises.readFile(url);
    }

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

/**
 * Resize and re-encode image for PDF embedding. Reduces file size (often 10×) by
 * capping resolution and using JPEG instead of full-res PNG.
 */
async function prepareImageForPdf(raw: Buffer): Promise<Buffer> {
  return sharp(raw)
    .resize(PDF_IMAGE_MAX_PX, PDF_IMAGE_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: PDF_IMAGE_JPEG_QUALITY })
    .toBuffer();
}

function formatBirthDate(dateStr: string): string {
  const raw = String(dateStr || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return raw;

  // Use UTC midnight to avoid local timezone shifting the date.
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return raw;

  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isLikelySubheadline(paragraph: string): boolean {
  const text = paragraph.trim().replace(/\s+/g, ' ');
  if (!text) return false;
  if (text.length < 10 || text.length > 140) return false;
  if (/^\d/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 18) return false;
  const upperWords = words.filter((w) => /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (upperWords / words.length >= 0.8) return true;
  if (/^THE\s+/i.test(text) && words.length >= 4) return true;
  const titleLikeWords = words.filter((w) => /^[A-Z][A-Za-z'’\-]*$/.test(w)).length;
  if (titleLikeWords / words.length >= 0.45) return true;
  // Sentence-case surreal headlines often come as a short, standalone sentence.
  if (words.length >= 4 && words.length <= 14 && /[.!?]$/.test(text)) return true;
  return false;
}

function splitEmbeddedHeadline(paragraph: string): { headline?: string; body: string } {
  const text = String(paragraph || '').trim().replace(/\s+/g, ' ');
  if (!text) return { body: '' };
  const m = text.match(/^((?:THE|A|AN)\s+[A-Z0-9'’\-]+(?:\s+[A-Z0-9'’\-]+){2,})\s+([A-Z][a-z].+)$/);
  if (!m) return { body: text };
  return {
    headline: m[1].trim(),
    body: m[2].trim(),
  };
}

function isInlineSentenceHeadlineCandidate(sentence: string): boolean {
  const text = String(sentence || '').trim();
  if (!text) return false;
  if (!/^(The|A|An)\s+/i.test(text)) return false;
  if (!/[.!?]$/.test(text)) return false;
  if (/[,:;]/.test(text)) return false;
  if (/\d/.test(text)) return false;

  const words = text.replace(/[.!?]$/, '').split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 14) return false;

  // Keep this conservative: only elevate sentence-headlines that clearly sound like section markers.
  const headlineNouns = [
    'room', 'door', 'curtain', 'year', 'fire', 'library', 'study', 'fog',
    'woman', 'man', 'dream', 'father', 'home', 'architecture', 'letter',
    'building', 'storm', 'threshold', 'kitchen', 'house', 'silence',
  ];
  const lower = text.toLowerCase();
  if (!headlineNouns.some((n) => lower.includes(n))) return false;
  return true;
}

function renderReadingText(doc: any, text: string, hasPlayfairBold: boolean): void {
  const normalized = String(text || '')
    // Keep inline all-caps headlines visible when model forgets hard line breaks.
    .replace(/([.!?])\s+((?:THE|A|AN)\s+[A-Z0-9'’\-]+(?:\s+[A-Z0-9'’\-]+){2,})\s+([A-Z][a-z])/g, '$1\n\n$2\n\n$3')
    // Keep inline sentence-case surreal headlines visible near the end sections.
    .replace(/([.!?])\s+((?:The|A|An)\s+[A-Za-z'’\-]+(?:\s+[A-Za-z'’\-]+){2,13}[.!?])\s+([A-Z])/g, (m, p1, candidate, p3) => {
      if (!isInlineSentenceHeadlineCandidate(candidate)) return m;
      return `${p1}\n\n${candidate}\n\n${p3}`;
    });

  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const rawParagraph of paragraphs) {
    const { headline, body } = splitEmbeddedHeadline(rawParagraph);
    if (headline) {
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(13).fillColor('#111111');
      doc.text(headline, { align: 'left' });
      doc.moveDown(0.35);
    }

    const paragraph = body;
    if (!paragraph) continue;

    if (isLikelySubheadline(paragraph)) {
      // Keep surreal subheadlines visible in the PDF with stronger typography.
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(13).fillColor('#111111');
      doc.text(paragraph, { align: 'left' });
      doc.moveDown(0.35);
      continue;
    }

    doc.font('Garamond').fontSize(11).fillColor('#111111');
    doc.text(paragraph, { align: 'justify' });
    doc.moveDown(0.8);
  }
}

function renderChartBox(doc: any, params: {
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text: string;
  hasPlayfairBold: boolean;
}): void {
  const { x, y, width, height, title, text, hasPlayfairBold } = params;
  doc.save();
  doc.roundedRect(x, y, width, height, 10).lineWidth(1).strokeColor('#d1d5db').stroke();
  if (title) {
    doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(10).fillColor('#7a4a12');
    doc.text(title, x + 10, y + 8, { width: width - 20, align: 'left' });
  }

  const bodyTop = title ? y + 26 : y + 10;
  doc.rect(x + 8, bodyTop, width - 16, height - (bodyTop - y) - 10).clip();
  doc.font('Courier').fontSize(7.7).fillColor('#111111');
  doc.text(String(text || ''), x + 12, bodyTop + 2, {
    width: width - 24,
    align: 'left',
    lineGap: 0.3,
  });
  doc.restore();
}

function renderChartReferenceText(doc: any, chartReferencePage: string, hasPlayfairBold: boolean, chartReferencePageRight?: string): void {
  const left = String(chartReferencePage || '').trim();
  const right = String(chartReferencePageRight || '').trim();
  if (!left && !right) return;

  const pageTop = 90;
  const pageBottomPadding = 90;
  const availableHeight = doc.page.height - pageTop - pageBottomPadding;

  doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(15).fillColor('#7a4a12')
    .text('Natal Chart Overview', 60, 56, { align: 'center', width: doc.page.width - 120 });

  if (right) {
    const gap = 16;
    const leftW = (doc.page.width - 100 - gap) / 2;
    const rightW = leftW;
    const startX = 50;
    renderChartBox(doc, {
      x: startX,
      y: pageTop,
      width: leftW,
      height: availableHeight,
      text: left,
      hasPlayfairBold,
    });
    renderChartBox(doc, {
      x: startX + leftW + gap,
      y: pageTop,
      width: rightW,
      height: availableHeight,
      text: right,
      hasPlayfairBold,
    });
    return;
  }

  renderChartBox(doc, {
    x: 60,
    y: pageTop,
    width: doc.page.width - 120,
    height: availableHeight,
    text: left,
    hasPlayfairBold,
  });
}

type CompatibilityRow = { label: string; score: number };
function extractCompatibilityRows(reading: string): CompatibilityRow[] {
  const text = String(reading || '');
  const labels = [
    'Karmic Bond',
    'Daily Life Together',
    'Emotional and Sexual Depth',
    'Growth Potential',
    'Danger',
    'Danger/Risk',
    'Timing',
    'Overall',
  ];
  const rows: CompatibilityRow[] = [];
  for (const label of labels) {
    const re = new RegExp(`${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^\\d]{0,30}(\\d{1,2}(?:\\.\\d)?)\\s*\\/\\s*10`, 'i');
    const m = text.match(re);
    if (!m) continue;
    const score = Number(m[1]);
    if (!Number.isFinite(score)) continue;
    rows.push({ label, score: Math.max(0, Math.min(10, score)) });
  }
  const dedup = new Map<string, CompatibilityRow>();
  for (const r of rows) {
    const key = r.label.toLowerCase().replace('/risk', '');
    if (!dedup.has(key)) dedup.set(key, r);
  }
  return Array.from(dedup.values());
}

function renderCompatibilitySnapshotPage(doc: any, rows: CompatibilityRow[], hasPlayfairBold: boolean): void {
  if (!rows.length) return;
  doc.addPage();
  doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(18).fillColor('#7a4a12')
    .text('Compatibility Snapshot', { align: 'center' });
  doc.moveDown(0.7);

  const left = 90;
  const right = doc.page.width - 90;
  const maxBar = 220;
  let y = doc.y + 10;
  for (const row of rows) {
    if (y > doc.page.height - 110) {
      doc.addPage();
      y = 110;
    }
    doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(11).fillColor('#111111')
      .text(row.label, left, y, { width: right - left - maxBar - 55 });
    const barX = right - maxBar - 20;
    const barY = y + 4;
    doc.roundedRect(barX, barY, maxBar, 10, 5).lineWidth(0.8).strokeColor('#d1d5db').stroke();
    const fillW = (row.score / 10) * maxBar;
    doc.roundedRect(barX, barY, fillW, 10, 5).fillColor('#b91c1c').fill();
    doc.font('Garamond').fontSize(10).fillColor('#111111')
      .text(`${row.score.toFixed(1)}/10`, right - 45, y, { width: 45, align: 'right' });
    y += 28;
  }
  doc.moveDown(1.2);
}

function renderLegacyChartReferenceText(doc: any, chartReferencePage: string, hasPlayfairBold: boolean): void {
  const lines = String(chartReferencePage || '').split('\n');
  doc.font('Garamond').fontSize(11).fillColor('#111111');
  for (const rawLine of lines) {
    const line = rawLine ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.4);
      continue;
    }
    if (/^(?:═{8,}|-{8,})$/.test(trimmed)) {
      doc.font('Garamond').fontSize(9).fillColor('#9ca3af').text(trimmed, { align: 'left' });
      doc.moveDown(0.1);
      continue;
    }
    if (/^NATAL CHART\b/i.test(trimmed)) {
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(18).fillColor('#7a4a12').text(trimmed, { align: 'left' });
      doc.moveDown(0.3);
      continue;
    }
    if (/^(THE BIG THREE|PERSONAL PLANETS|OUTER PLANETS|NODES|KEY ASPECTS|CURRENT TRANSITS|PROFECTION)\b/i.test(trimmed)) {
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(12.5).fillColor('#111111').text(trimmed, { align: 'left' });
      doc.moveDown(0.15);
      continue;
    }
    if (/^(Born:|Age:)/i.test(trimmed)) {
      doc.font('Garamond').fontSize(10).fillColor('#4b5563').text(trimmed, { align: 'left' });
      continue;
    }
    doc.font('Garamond').fontSize(11).fillColor('#111111').text(trimmed, { align: 'left' });
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      doc.font('Garamond').fontSize(11).fillColor('#111111');
    }
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

  // Fetch portrait images
  const [person1Portrait, person2Portrait, couplePortrait] = await Promise.all([
    options.person1.portraitUrl ? fetchImageBuffer(options.person1.portraitUrl) : Promise.resolve(null),
    options.person2?.portraitUrl ? fetchImageBuffer(options.person2.portraitUrl) : Promise.resolve(null),
    options.coupleImageUrl ? fetchImageBuffer(options.coupleImageUrl) : Promise.resolve(null),
  ]);

  const imageToUse = options.type === 'single'
    ? person1Portrait
    : (couplePortrait || person1Portrait);
  let imageForPdf: Buffer | null = null;
  if (imageToUse) {
    try {
      imageForPdf = await prepareImageForPdf(imageToUse);
    } catch (e) {
      console.warn('[pdfGenerator] prepareImageForPdf failed, using raw image:', e);
      imageForPdf = imageToUse;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 120, bottom: 120, left: 100, right: 100 },
        bufferPages: true,
      });

      // Register Garamond font
      if (fs.existsSync(GARAMOND)) {
        doc.registerFont('Garamond', GARAMOND);
      }
      const hasPlayfairBold = fs.existsSync(PLAYFAIR_BOLD);
      if (hasPlayfairBold) {
        doc.registerFont('PlayfairBold', PLAYFAIR_BOLD);
      }

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      let pageCount = 1;
      doc.on('pageAdded', () => { pageCount++; });

      // ─────────────────────────────────────────────────────────────
      // Cover page (title + people)
      // ─────────────────────────────────────────────────────────────
      const timestamp = options.generatedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.font('Garamond').fillColor('#7a4a12').fontSize(21).text(options.title, { align: 'center' });

      if (options.subtitle) {
        doc.moveDown(0.25);
        doc.fillColor('#b91c1c').fontSize(11).text(options.subtitle, { align: 'center' });
      }

      doc.fillColor('#111111');
      doc.moveDown(2);

      const renderPersonCover = (person: PDFGenerationOptions['person1'], showName = true) => {
        if (showName) {
          doc.font('Garamond').fillColor('#111111').fontSize(14).text(person.name, { align: 'center' });
        }

        const birthBits: string[] = [];
        const birthDate = formatBirthDate(person.birthDate);
        if (birthDate) birthBits.push(birthDate);
        if (person.birthTime) birthBits.push(person.birthTime);
        if (person.birthPlace) birthBits.push(person.birthPlace);
        if (person.timezone && !person.birthPlace) birthBits.push(person.timezone);

        const birthLine = birthBits.filter(Boolean).join(' · ');
        if (birthLine) {
          doc.fillColor('#4b5563').fontSize(9).text(birthLine, { align: 'center' });
          doc.fillColor('#111111');
        }
      };

      const titleLower = String(options.title || '').toLowerCase();
      const p1InTitle = titleLower.includes(String(options.person1.name || '').toLowerCase());
      renderPersonCover(options.person1, !p1InTitle);

      if (options.person2) {
        doc.moveDown(1.25);
        doc.fillColor('#6b7280').fontSize(12).text('&', { align: 'center' });
        doc.fillColor('#111111');
        doc.moveDown(0.75);
        const p2InTitle = titleLower.includes(String(options.person2.name || '').toLowerCase());
        renderPersonCover(options.person2, !p2InTitle);
      }

      doc.moveDown(options.person2 ? 1.0 : 0.45);
      doc.fillColor('#4b5563').fontSize(10).text(`written: ${timestamp}`, { align: 'center' });
      doc.fillColor('#111111');

      if (String(options.coverQuote || '').trim()) {
        doc.moveDown(options.person2 ? 1.1 : 0.75);
        doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fillColor('#111111').fontSize(12);
        doc.text(String(options.coverQuote || '').trim(), {
          align: 'center',
          lineGap: 2,
        });
      }

      // Portrait image on the cover page (page 1).
      if (imageForPdf) {
        const imgWidth = doc.page.width - 100 - 100;
        const imgX = 100;
        const imgY = doc.y + 20;
        const imgHeight = imgWidth;
        const radius = 20;
        
        try {
          doc.save();
          doc.roundedRect(imgX, imgY, imgWidth, imgHeight, radius).clip();
          doc.image(imageForPdf, imgX, imgY, { width: imgWidth });
          doc.restore();
          doc.y = imgY + imgHeight + 20;
        } catch {
          // ignore image errors
        }
        doc.moveDown(2);
      } else {
        doc.moveDown(1);
      }

      if (String(options.chartReferencePage || '').trim().length > 0 || String(options.chartReferencePageRight || '').trim().length > 0) {
        // Chart reference page (PDF-only, no prose interpretation).
        doc.addPage();
        renderChartReferenceText(doc, options.chartReferencePage || '', hasPlayfairBold, options.chartReferencePageRight);
      }

      // Start reading prose on a fresh page.
      doc.addPage();

      // Body text
      for (const chapter of options.chapters) {
        if (chapter.person1Reading) {
          renderReadingText(doc, chapter.person1Reading, hasPlayfairBold);
        }
        if (chapter.person2Reading) {
          renderReadingText(doc, chapter.person2Reading, hasPlayfairBold);
        }
        if (chapter.overlayReading) {
          renderReadingText(doc, chapter.overlayReading, hasPlayfairBold);
        }
        if (chapter.verdict) {
          renderReadingText(doc, chapter.verdict, hasPlayfairBold);
        }
      }

      if (options.type === 'overlay') {
        const overlayText = options.chapters.map((c) => c.overlayReading || '').join('\n\n');
        const compatibilityRows = extractCompatibilityRows(overlayText);
        if (compatibilityRows.length > 0) {
          renderCompatibilitySnapshotPage(doc, compatibilityRows, hasPlayfairBold);
        }
      }

      // Appendix - LEFT aligned
      doc.moveDown(3);
      doc.font('Garamond').fontSize(10);
      doc.text('1-in-a-billion.app', { align: 'left' });
      doc.moveDown(1);
      doc.text('Published by:', { align: 'left' });
      doc.text('SwiftBuy Solutions LLC', { align: 'left' });
      doc.text('Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.', { align: 'left' });
      doc.moveDown(1);
      doc.text('powered by: forbidden-yoga.com', { align: 'left' });
      doc.text('Program idea and concept: Michael Wogenburg', { align: 'left' });

      // Add page numbers to all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Save current position
        const savedY = doc.y;
        // Draw page number at bottom - use absolute positioning
        doc.font('Garamond').fontSize(10);
        doc.page.margins.bottom = 0;
        doc.text(String(i + 1), 100, doc.page.height - 60, { 
          width: doc.page.width - 200, 
          align: 'center',
          lineBreak: false,
          continued: false
        });
        doc.page.margins.bottom = 120;
        doc.y = savedY;
      }

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
  person2?: PDFGenerationOptions['person2'],
  coupleImageUrl?: string
): Promise<{ filePath: string; pageCount: number }> {
  // ⚠️ CRITICAL VALIDATION: Prevent using same content for different reading types
  // Count how many reading fields have content
  const contentFields = [
    chapter.person1Reading,
    chapter.person2Reading,
    chapter.overlayReading,
    chapter.verdict,
  ].filter(Boolean);
  
  if (contentFields.length === 0) {
    throw new Error('CRITICAL PDF ERROR: No reading content provided in chapter');
  }
  
  if (contentFields.length > 1) {
    throw new Error(
      `CRITICAL PDF ERROR: Multiple reading fields have content (${contentFields.length} fields). ` +
      `Only ONE should have content per PDF. This prevents the bug where same content is used for all PDFs.`
    );
  }
  
  // Validate person2 readings have person2 data
  if (chapter.person2Reading && !person2) {
    throw new Error('CRITICAL PDF ERROR: person2Reading provided but no person2 data');
  }
  
  // Validate overlay readings have person2 data
  if (chapter.overlayReading && !person2) {
    throw new Error('CRITICAL PDF ERROR: overlayReading provided but no person2 data');
  }
  
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
