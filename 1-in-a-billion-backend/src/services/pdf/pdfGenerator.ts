import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Font path
const FONTS_DIR = path.resolve(__dirname, '../../../assets/fonts');
const GARAMOND = path.join(FONTS_DIR, 'EBGaramond-Regular.ttf');

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
  person1: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  person2?: { name: string; birthDate: string; sunSign?: string; moonSign?: string; risingSign?: string; portraitUrl?: string };
  coupleImageUrl?: string;
  chapters: ChapterContent[];
  generatedAt: Date;
  spicyScore?: number;
  safeStableScore?: number;
  compatibilityScore?: number;
  finalVerdict?: string;
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

  // Fetch portrait images
  const [person1Portrait, person2Portrait, couplePortrait] = await Promise.all([
    options.person1.portraitUrl ? fetchImageBuffer(options.person1.portraitUrl) : Promise.resolve(null),
    options.person2?.portraitUrl ? fetchImageBuffer(options.person2.portraitUrl) : Promise.resolve(null),
    options.coupleImageUrl ? fetchImageBuffer(options.coupleImageUrl) : Promise.resolve(null),
  ]);

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

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      let pageCount = 1;
      doc.on('pageAdded', () => { pageCount++; });

      // Title
      doc.font('Garamond').fontSize(18).text(options.title, { align: 'center' });
      
      // Timestamp below title
      const timestamp = options.generatedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.font('Garamond').fontSize(10).text(timestamp, { align: 'center' });
      doc.moveDown(1);

      // Portrait image: solo for single-person readings, couple for overlay
      // CRITICAL: Single person PDFs must show solo portrait, NOT couple image
      const imageToUse = options.type === 'single' 
        ? person1Portrait  // Single person reading = solo portrait only
        : (couplePortrait || person1Portrait);  // Overlay/nuclear = couple if available
      if (imageToUse) {
        // Image width matches text width (page width minus left and right margins)
        const imgWidth = doc.page.width - 100 - 100; // 395pt on A4
        const imgX = 100; // Same as left margin
        const imgY = doc.y + 20; // Space above image
        const imgHeight = imgWidth; // Assume square-ish image
        const radius = 20; // Rounded corner radius
        
        try {
          // Create rounded rectangle clipping path
          doc.save();
          doc.roundedRect(imgX, imgY, imgWidth, imgHeight, radius).clip();
          doc.image(imageToUse, imgX, imgY, { width: imgWidth });
          doc.restore();
          
          // Move cursor below the image
          doc.y = imgY + imgHeight + 20; // Image height + padding
        } catch {
          // ignore image errors
        }
        
        doc.moveDown(2); // Space below image
      } else {
        doc.moveDown(1);
      }

      // Body text - justified (block)
      for (const chapter of options.chapters) {
        if (chapter.person1Reading) {
          doc.font('Garamond').fontSize(11).text(chapter.person1Reading, { align: 'justify' });
          doc.moveDown(1);
        }
        if (chapter.person2Reading) {
          doc.font('Garamond').fontSize(11).text(chapter.person2Reading, { align: 'justify' });
          doc.moveDown(1);
        }
        if (chapter.overlayReading) {
          doc.font('Garamond').fontSize(11).text(chapter.overlayReading, { align: 'justify' });
          doc.moveDown(1);
        }
        if (chapter.verdict) {
          doc.font('Garamond').fontSize(11).text(chapter.verdict, { align: 'justify' });
          doc.moveDown(1);
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
