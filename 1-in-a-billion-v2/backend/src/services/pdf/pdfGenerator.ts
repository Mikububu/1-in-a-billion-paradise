import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Font path
const FONTS_DIR = path.resolve(__dirname, '../../../assets/fonts');
const GARAMOND = path.join(FONTS_DIR, 'EBGaramond-Regular.ttf');
const GARAMOND_BOLD = path.join(FONTS_DIR, 'EBGaramond-Bold.ttf');
const PLAYFAIR_BOLD = path.join(FONTS_DIR, 'PlayfairDisplay_700Bold.ttf');
const ENABLE_CHART_REFERENCE_PAGE = true;

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

type SignatureExtraction = {
  body: string;
  signature?: string;
  dataLine?: string;
};

type SignatureBlock = {
  system: string;
  label: string;
  signature: string;
  dataLine?: string;
};

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
  compatibilityAppendix?: string;
  /** Pre-computed compatibility scores from separate LLM scoring call (PDF-only, not in reading text) */
  compatibilityScores?: Array<{ label: string; score: number; scoreTen: number; note: string }>;
  generatedAt: Date;
  spicyScore?: number;
  safeStableScore?: number;
  compatibilityScore?: number;
  finalVerdict?: string;
  allowInferredHeadlines?: boolean;
}

function buildOverlayCoverTitle(title: string): string {
  const raw = String(title || '').trim();
  if (!raw) return 'Compatibility Reading';
  const m = raw.match(/^(.+?)\s+Reading\b/i);
  if (!m?.[1]) return raw;
  return `${m[1].trim()} Reading`;
}

function formatPersonCoverLine(person: PDFGenerationOptions['person1']): string {
  const birthDate = formatBirthDate(person.birthDate);
  const time = String(person.birthTime || '').trim();
  const place = String(person.birthPlace || person.timezone || '').trim();
  return [
    birthDate ? `birthday: ${birthDate}` : '',
    time ? `time: ${time}` : '',
    place ? `location: ${place}` : '',
  ].filter(Boolean).join(' · ');
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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

    const candidates = [url];
    if (/^https?:\/\//i.test(url) && url.includes('?')) {
      // Cache-buster query can occasionally fail on CDN edge; retry once without query.
      candidates.push(url.split('?')[0]);
    }

    let lastError = '';
    for (const candidate of candidates) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 25000);
          const res = await fetch(candidate, { signal: controller.signal });
          clearTimeout(t);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ab = await res.arrayBuffer();
          const buf = Buffer.from(ab);
          if (buf.length > 0) return buf;
          throw new Error('empty image response');
        } catch (err: any) {
          lastError = err?.message || String(err);
          if (attempt < 3) await sleep(350 * attempt);
        }
      }
    }

    console.warn(`[PDF] Failed to load portrait image: ${url} (${lastError})`);
    return null;
  } catch (err: any) {
    console.warn(`[PDF] Unexpected portrait image error: ${url} (${err?.message || String(err)})`);
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
  if (text.length < 12 || text.length > 140) return false;
  if (/^\d/.test(text)) return false;
  // Real headings should not contain sentence punctuation inside.
  if (/[,:;]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 18) return false;
  if (/[.!?]$/.test(text)) return false;
  const upperWords = words.filter((w) => /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (upperWords / words.length >= 0.9) return true;
  if (/^(?:THE|The|A|An|What|When|How|Why|Who)\s+/i.test(text) && words.length >= 4) return true;
  const titleLikeWords = words.filter((w) => /^[A-Z][A-Za-z'’\-]*$/.test(w) || /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (titleLikeWords / words.length >= 0.85) return true;
  return false;
}

function splitEmbeddedHeadline(paragraph: string): { headline?: string; body: string } {
  const text = String(paragraph || '').trim().replace(/\s+/g, ' ');
  if (!text) return { body: '' };
  const stripped = text
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-–—]{2,}\s*/, '')
    .replace(/^\s*(?:\d+[.)]|[IVXLC]+\.)\s*/i, '')
    .trim();
  if (/^[-–—]{3,}\s*$/.test(stripped)) return { body: '' };
  const mUpper = stripped.match(/^((?:THE|A|AN|WHAT|WHEN|HOW|WHY|WHO)\s+[A-Z0-9'’\-]+(?:\s+[A-Z0-9'’\-]+){2,})\s+([A-Z][a-z].+)$/);
  if (mUpper) {
    const body = mUpper[2].trim();
    const bodyWords = body.split(/\s+/).filter(Boolean).length;
    if (bodyWords <= 3) {
      return { headline: stripped, body: '' };
    }
    return {
      headline: mUpper[1].trim(),
      body,
    };
  }
  const mTitle = stripped.match(/^((?:The|A|An|What|When|How|Why|Who)\s+[A-Z][a-z'’\-]+(?:\s+[A-Z][a-z'’\-]+){2,11})\s+([A-Z][a-z].+)$/);
  if (mTitle) {
    const body = mTitle[2].trim();
    const bodyWords = body.split(/\s+/).filter(Boolean).length;
    if (bodyWords <= 3) {
      return { headline: stripped, body: '' };
    }
    return {
      headline: mTitle[1].trim(),
      body,
    };
  }
  if (isLikelySubheadline(stripped)) return { headline: stripped, body: '' };
  return { body: stripped };
}

function isOrphanLeadLine(paragraph: string): boolean {
  const text = String(paragraph || '').trim();
  if (!text) return false;
  if (isLikelySubheadline(text)) return false;
  if (/^[#\-–—]/.test(text)) return false;
  if (/[.!?;:]$/.test(text)) return false;
  if (/[,:;]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  // Keep this conservative: orphan lead lines are usually tiny starters like
  // "Before", "Then", "At night", which should be glued to the following paragraph.
  return true;
}

function isInlineSentenceHeadlineCandidate(sentence: string): boolean {
  const text = String(sentence || '').trim();
  if (!text) return false;
  if (!/^(The|A|An|What|When|How|Why|Who)\s+/i.test(text)) return false;
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

function isInlineTitleHeadlineCandidate(candidate: string): boolean {
  const text = String(candidate || '').trim();
  if (!text) return false;
  if (!/^(?:The|A|An|What|When|How|Why|Who)\s+/.test(text)) return false;
  if (/[,:;.!?]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 12) return false;
  const connectors = new Set([
    'of', 'the', 'and', 'to', 'that', 'where', 'when', 'who', 'in', 'on', 'at',
    'for', 'from', 'with', 'without', 'into', 'between', 'is', 'are', 'was', 'were',
    'no', 'not',
  ]);
  const meaningfulWords = words.filter((w) => !connectors.has(w.toLowerCase()));
  const titleLikeWords = meaningfulWords.filter((w) => /^[A-Z][A-Za-z'’\-]*$/.test(w)).length;
  if (meaningfulWords.length > 0 && titleLikeWords / meaningfulWords.length < 0.8) return false;

  // Keep promotion conservative: only with clear section-marker nouns.
  const markers = [
    'room', 'door', 'curtain', 'year', 'fire', 'library', 'study', 'fog',
    'woman', 'man', 'dream', 'father', 'home', 'architecture', 'letter',
    'building', 'storm', 'threshold', 'kitchen', 'house', 'silence',
    'offer', 'cost', 'machine', 'hunger', 'reckoning', 'weather',
  ];
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

function renderReadingText(doc: any, text: string, hasPlayfairBold: boolean, allowInferredHeadlines: boolean = true): void {
  if (!allowInferredHeadlines) {
    const joined = String(text || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' ');

    doc.font('Garamond').fontSize(10).fillColor('#111111');
    doc.text(joined, doc.page.margins.left, undefined, {
      align: 'justify',
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
    return;
  }

  const titleToken = "(?:[A-Z][A-Za-z'’\\-]*|of|the|and|to|that|where|when|who|in|on|at|for|from|with|without|into|between|is|are|was|were|no|not)";
  const inlineTitleHeadingRe = new RegExp(
    `([.!?])\\s+((?:The|A|An|What|When|How|Why|Who)\\s+${titleToken}(?:\\s+${titleToken}){2,14})\\s+([A-Z][a-z])`,
    'g'
  );

  const normalized = String(text || '')
    // Keep inline all-caps headlines visible when model forgets hard line breaks.
    .replace(/([.!?])\s+((?:THE|A|AN)\s+[A-Z0-9'’\-]+(?:\s+[A-Z0-9'’\-]+){2,})\s+([A-Z][a-z])/g, '$1\n\n$2\n\n$3')
    // Keep inline title-case headlines (without trailing punctuation) visible.
    .replace(inlineTitleHeadingRe, (m, p1, candidate, p3) => {
      if (!isInlineTitleHeadlineCandidate(candidate)) return m;
      return `${p1}\n\n${candidate}\n\n${p3}`;
    })
    // Keep inline sentence-case surreal headlines visible near the end sections.
    .replace(/([.!?])\s+((?:The|A|An)\s+[A-Za-z'’\-]+(?:\s+[A-Za-z'’\-]+){2,13}[.!?])\s+([A-Z])/g, (m, p1, candidate, p3) => {
      if (!isInlineSentenceHeadlineCandidate(candidate)) return m;
      return `${p1}\n\n${candidate}\n\n${p3}`;
    });

  const rawParagraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Heal model outputs where a headline is broken into two lines:
  // "The Dream He Keeps Not" + "Having"
  const paragraphs: string[] = [];
  for (const line of rawParagraphs) {
    const prev = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';
    const prevWords = prev ? prev.split(/\s+/).filter(Boolean).length : 0;
    const prevLooksHeadline =
      Boolean(prev) &&
      prevWords >= 4 &&
      prevWords <= 18 &&
      !/[.!?]$/.test(prev) &&
      /^(?:THE|The|A|An)\s+/.test(prev);
    const lineLooksShortTail =
      /^[A-Z][A-Za-z'’\-]*(?:\s+[A-Z][A-Za-z'’\-]*){0,2}$/.test(line) &&
      !/[,:;.!?]$/.test(line);

    if (prevLooksHeadline && lineLooksShortTail) {
      paragraphs[paragraphs.length - 1] = `${prev} ${line}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    paragraphs.push(line);
  }

  // Heal orphan lead fragments that should belong to the following paragraph:
  // "Before" + "Tata could speak..."
  const normalizedParagraphs: string[] = [];
  for (let i = 0; i < paragraphs.length; i += 1) {
    const current = paragraphs[i] || '';
    const next = paragraphs[i + 1] || '';
    if (next && isOrphanLeadLine(current) && !isLikelySubheadline(next)) {
      normalizedParagraphs.push(`${current} ${next}`.replace(/\s+/g, ' ').trim());
      i += 1;
      continue;
    }
    normalizedParagraphs.push(current);
  }

  const wordsIn = (value: string): number => value.split(/\s+/).filter(Boolean).length;
  let isFirstAfterHeadline = true;
  const renderHeadlineLine = (line: string): void => {
    doc.moveDown(0.6);
    doc.font('GaramondBold').fontSize(12.8).fillColor('#111111');
    doc.text(line, { align: 'left' });
    doc.moveDown(0.25);
    wordsSinceLastHeadline = 0;
    isFirstAfterHeadline = true;
  };
  let wordsSinceLastHeadline = 999;
  for (let i = 0; i < normalizedParagraphs.length; i += 1) {
    const rawParagraph = normalizedParagraphs[i] || '';
    let { headline, body } = splitEmbeddedHeadline(rawParagraph);

    // Final guard: if a headline is followed by a tiny orphan line
    // ("The Woman Who Almost Saw" + "Him"), merge it into the heading.
    if (headline && !body) {
      const next = normalizedParagraphs[i + 1] || '';
      if (next && isOrphanLeadLine(next)) {
        headline = `${headline} ${next}`.replace(/\s+/g, ' ').trim();
        i += 1;
      }
    }

    if (headline) {
      renderHeadlineLine(headline);
    }

    const paragraph = body;
    if (!paragraph) continue;

    if (isLikelySubheadline(paragraph)) {
      let heading = paragraph;
      const next = normalizedParagraphs[i + 1] || '';
      if (next && isOrphanLeadLine(next)) {
        heading = `${heading} ${next}`.replace(/\s+/g, ' ').trim();
        i += 1;
      }
      renderHeadlineLine(heading);
      continue;
    }

    doc.font('Garamond').fontSize(11).fillColor('#111111');
    doc.text(paragraph, doc.page.margins.left, undefined, {
      align: 'justify',
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
    doc.moveDown(0.25);
    isFirstAfterHeadline = false;
    wordsSinceLastHeadline += wordsIn(paragraph);
  }
}

function extractChartSignatureFooter(rawText?: string): SignatureExtraction {
  const raw = String(rawText || '').trim();
  if (!raw) return { body: '' };
  const lines = raw.split('\n');
  const sigStart = lines.findIndex((line) => /^\s*Chart Signature\s*:/i.test(line));
  if (sigStart < 0) return { body: raw };

  const sigParts: string[] = [];
  let dataLine: string | undefined;
  for (let i = sigStart; i < lines.length; i += 1) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    if (/^\s*Data\s*:/i.test(line)) {
      dataLine = line.replace(/^\s*Data\s*:\s*/i, '').trim();
      continue;
    }
    if (/^\s*Chart Signature\s*:/i.test(line)) {
      sigParts.push(line.replace(/^\s*Chart Signature\s*:\s*/i, '').trim());
      continue;
    }
    sigParts.push(line);
  }

  const body = lines.slice(0, sigStart).join('\n').trim();
  const signature = sigParts.join(' ').replace(/\s+/g, ' ').trim();
  return { body, signature, dataLine };
}

function buildSystemGlossary(system: string): Array<{ term: string; meaning: string }> {
  const key = String(system || '').toLowerCase().replace(/-/g, '_');
  switch (key) {
    case 'vedic':
      return [
        { term: 'Lagna', meaning: 'Ascendant sign at birth; your lived interface with the world.' },
        { term: 'Rahu', meaning: 'North node force: appetite, future pull, and unfinished hunger.' },
        { term: 'Ketu', meaning: 'South node force: inherited mastery and unconscious release pattern.' },
        { term: 'Mahadasha', meaning: 'Major life chapter lord; sets the long emotional climate.' },
        { term: 'Antardasha', meaning: 'Sub-chapter lord; describes the active current phase.' },
        { term: 'Neecha', meaning: 'Debilitated condition; planet acts under pressure and requires maturity.' },
        { term: 'Ayanamsa', meaning: 'Sidereal calibration method used to align zodiac reference.' },
      ];
    case 'human_design':
      return [
        { term: 'Type', meaning: 'Core energetic strategy for decisions and movement.' },
        { term: 'Authority', meaning: 'Reliable inner decision channel when pressure rises.' },
        { term: 'Defined Center', meaning: 'Stable energetic function that repeats consistently.' },
        { term: 'Open Center', meaning: 'Amplifier zone where conditioning from others enters.' },
        { term: 'Gate', meaning: 'Specific trait frequency activated in the bodygraph.' },
        { term: 'Channel', meaning: 'Two connected gates forming a stable behavioral circuit.' },
      ];
    case 'gene_keys':
      return [
        { term: 'Gene Key', meaning: 'A behavioral code with Shadow, Gift, and Siddhi expressions.' },
        { term: 'Shadow', meaning: 'Contracted pattern that repeats under stress or fear.' },
        { term: 'Gift', meaning: 'Mature expression that appears with awareness and practice.' },
        { term: 'Siddhi', meaning: 'Peak state of consciousness at the highest frequency.' },
        { term: 'Activation Sequence', meaning: 'Life foundation pattern of purpose, vitality, and direction.' },
        { term: 'Venus Sequence', meaning: 'Relational imprinting and emotional bonding architecture.' },
      ];
    case 'kabbalah':
      return [
        { term: 'Sefirot', meaning: 'Core channels of consciousness in the Tree of Life map.' },
        { term: 'Tikkun', meaning: 'Repair trajectory: what the soul is here to refine.' },
        { term: 'Klipoth', meaning: 'Protective distortion layer that forms around unresolved wounds.' },
        { term: 'Pillars', meaning: 'Modes of force: expansion, structure, and integration.' },
        { term: 'Four Worlds', meaning: 'Levels of manifestation from idea to embodied action.' },
      ];
    case 'western':
    default:
      return [
        { term: 'ASC', meaning: 'Ascendant mask: first-contact style and instinctive stance.' },
        { term: 'Stellium', meaning: 'Planet cluster intensifying one psychological life department.' },
        { term: 'Conjunction', meaning: 'Two forces merged into one louder behavioral engine.' },
        { term: 'Square', meaning: 'Friction aspect that demands adaptation and reorganization.' },
        { term: 'Opposition', meaning: 'Polarity tension asking for relational balance, not control.' },
        { term: 'Transit', meaning: 'Current sky pressure interacting with natal pattern wiring.' },
      ];
  }
}

function pickGlossaryEntries(system: string, signatureText: string): Array<{ term: string; meaning: string }> {
  const pool = buildSystemGlossary(system);
  const sig = String(signatureText || '').toLowerCase();
  if (!sig) return pool.slice(0, 5);
  const matched = pool.filter((entry) => sig.includes(entry.term.toLowerCase()));
  if (matched.length >= 5) return matched.slice(0, 8);
  const seen = new Set(matched.map((e) => e.term.toLowerCase()));
  for (const entry of pool) {
    if (matched.length >= 5) break;
    if (seen.has(entry.term.toLowerCase())) continue;
    matched.push(entry);
    seen.add(entry.term.toLowerCase());
  }
  return matched.slice(0, 8);
}

function renderSignatureGlossaryPage(doc: any, blocks: SignatureBlock[], hasPlayfairBold: boolean): void {
  if (!blocks.length) return;
  doc.addPage();
  doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(17).fillColor('#7a4a12')
    .text('Chart Signature Glossary', { align: 'center' });
  doc.moveDown(0.5);

  for (const block of blocks) {
    if (doc.y > doc.page.height - 220) {
      doc.addPage();
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(17).fillColor('#7a4a12')
        .text('Chart Signature Glossary', { align: 'center' });
      doc.moveDown(0.5);
    }

    const signatureLine = block.signature.trim();
    const dataSuffix = block.dataLine ? `\nData: ${block.dataLine}` : '';
    renderChartBox(doc, {
      x: 60,
      y: doc.y,
      width: doc.page.width - 120,
      height: 88,
      title: block.label,
      text: `${signatureLine}${dataSuffix}`,
      hasPlayfairBold,
    });
    doc.y += 98;

    const glossaryEntries = pickGlossaryEntries(block.system, signatureLine);
    doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(12).fillColor('#111111')
      .text('Glossary', 60, doc.y, { width: doc.page.width - 120, align: 'left' });
    doc.moveDown(0.2);
    for (const entry of glossaryEntries) {
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(10.5).fillColor('#111111')
        .text(`${entry.term}: `, 70, doc.y, { continued: true });
      doc.font('Garamond').fontSize(10.5).fillColor('#4b5563')
        .text(entry.meaning, { width: doc.page.width - 150, align: 'left' });
      if (doc.y > doc.page.height - 120) break;
    }
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

type CompatibilityRow = { label: string; score: number; note?: string };

/**
 * Extract compatibility scores from LLM-generated reading text.
 *
 * The LLM appends a COMPATIBILITY SNAPSHOT block at the end of each overlay
 * reading (and a larger COMPATIBILITY SCORES block in the verdict).
 *
 * Format produced by the LLM:
 *   SEXUAL CHEMISTRY: 72
 *   Two sentences of reasoning about the score.
 *
 * Scores are on a 0-100 scale. We convert to 0-10 for the PDF progress bars.
 */
function extractCompatibilityRows(reading: string, _appendix?: string): CompatibilityRow[] {
  const text = String(reading || '');

  // ── Strategy 1: Parse LLM /100 format ──────────────────────────────────
  // Match lines like "SEXUAL CHEMISTRY: 72" or "OVERALL ALIGNMENT: 95"
  // followed by sentence(s) until the next score label or end of text.
  const scoreBlockRe = /^([A-Z][A-Z &\-\/]+?):\s*(\d{1,3})\s*$/gm;
  const matches: Array<{ label: string; score100: number; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = scoreBlockRe.exec(text)) !== null) {
    const rawLabel = (m[1] || '').trim();
    const score100 = Number(m[2]);
    if (!rawLabel || !Number.isFinite(score100)) continue;
    // Skip header lines like "COMPATIBILITY SNAPSHOT:" or "SCORING RULES:"
    if (/^(COMPATIBILITY|SCORING|FORMAT|OUTPUT|STRUCTURE|STYLE)/i.test(rawLabel)) continue;
    if (score100 < 0 || score100 > 100) continue;
    matches.push({ label: toTitleCase(rawLabel), score100, index: m.index + m[0].length });
  }

  if (matches.length >= 3) {
    const rows: CompatibilityRow[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index - matches[i + 1].label.length - 10 : text.length;
      // Extract the note text between this score line and the next
      const noteText = text.slice(current.index, nextIndex).trim();
      // Take the first 2-4 sentences as the note
      const sentences = noteText
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 10)
        .slice(0, 4);
      const note = sentences.join(' ').trim() || undefined;
      rows.push({
        label: current.label,
        score: Math.max(0, Math.min(10, Math.round((current.score100 / 10) * 10) / 10)),
        note,
      });
    }
    return rows.slice(0, 14);
  }

  // ── Strategy 2: Legacy /10 format (backward compat) ────────────────────
  const legacyRe = /^-?\s*([^:]{3,60}):\s*(\d{1,2}(?:\.\d+)?)\s*\/\s*10\s*(?:[—-]\s*(.+))?$/gmi;
  const legacyRows: CompatibilityRow[] = [];
  while ((m = legacyRe.exec(text)) !== null) {
    const label = (m[1] || '').trim();
    const score = Number(m[2]);
    const note = (m[3] || '').trim() || undefined;
    if (!label || !Number.isFinite(score)) continue;
    legacyRows.push({ label, score: Math.max(0, Math.min(10, score)), note });
  }
  if (legacyRows.length >= 3) return legacyRows.slice(0, 14);

  return [];
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function renderCompatibilitySnapshotPage(doc: any, rows: CompatibilityRow[], hasPlayfairBold: boolean): void {
  if (!rows.length) return;
  doc.addPage();

  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  // Title
  doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(16).fillColor('#7a4a12')
    .text('Compatibility Snapshot', { width: contentWidth, align: 'center' });
  doc.moveDown(1.0);

  for (const row of rows) {
    // Pre-measure full row
    doc.font('Garamond').fontSize(9);
    const noteH = row.note ? doc.heightOfString(row.note, { width: contentWidth }) : 0;
    const rowH = 16 + 12 + noteH + 24; // label + bar + note + generous gap

    if (doc.y + rowH > pageBottom) {
      doc.addPage();
    }

    // ── Label left, score right on same line ──
    const lineY = doc.y;
    doc.font(hasPlayfairBold ? 'PlayfairBold' : 'GaramondBold').fontSize(10.5).fillColor('#111111');
    doc.text(row.label, left, lineY, { width: contentWidth - 60, continued: false });
    doc.font('Garamond').fontSize(10).fillColor('#555555');
    doc.text(`${row.score.toFixed(1)}/10`, left, lineY, { width: contentWidth, align: 'right' });

    // ── Progress bar ──
    const barY = lineY + 15;
    doc.roundedRect(left, barY, contentWidth, 6, 3).lineWidth(0.5).strokeColor('#d1d5db').stroke();
    doc.roundedRect(left, barY, (row.score / 10) * contentWidth, 6, 3).fillColor('#b91c1c').fill();

    // Advance doc.y past the bar
    doc.y = barY + 10;
    doc.x = left;

    // ── Note text ── NO explicit x,y on doc.text — pure auto-flow for pagination
    if (row.note) {
      doc.font('Garamond').fontSize(9).fillColor('#4b5563');
      doc.text(row.note, { width: contentWidth });
    }

    // Generous spacing between rows
    doc.moveDown(1.0);
  }
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

      // Register Garamond font family
      if (fs.existsSync(GARAMOND)) {
        doc.registerFont('Garamond', GARAMOND);
      }
      if (fs.existsSync(GARAMOND_BOLD)) {
        doc.registerFont('GaramondBold', GARAMOND_BOLD);
      } else {
        doc.registerFont('GaramondBold', GARAMOND);
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

      const overlayMode = options.type === 'overlay' && Boolean(options.person2);
      const coverTitle = overlayMode ? buildOverlayCoverTitle(options.title) : options.title;
      doc.font('Garamond').fillColor('#7a4a12').fontSize(21).text(coverTitle, { align: 'center' });
      const coverMetaFontSize = 13;

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
          doc.font('Garamond').fillColor('#4b5563').fontSize(coverMetaFontSize).text(birthLine, { align: 'center' });
          doc.fillColor('#111111');
        }
      };

      const renderCoverPersonLabel = (label: string) => {
        // Never inherit bold from heading styles.
        doc.font('Garamond').fillColor('#111111').fontSize(coverMetaFontSize).text(label, { align: 'center' });
      };

      if (overlayMode && options.person2) {
        // Keep cover identity lines readable and consistent (not bold)
        renderCoverPersonLabel(`Person 1: ${options.person1.name}`);
        const p1Line = formatPersonCoverLine(options.person1);
        if (p1Line) {
          doc.font('Garamond').fillColor('#4b5563').fontSize(coverMetaFontSize).text(p1Line, { align: 'center' });
        }
        doc.moveDown(0.9);
        doc.fillColor('#6b7280').fontSize(12).text('&', { align: 'center' });
        doc.moveDown(0.6);
        renderCoverPersonLabel(`Person 2: ${options.person2.name}`);
        const p2Line = formatPersonCoverLine(options.person2);
        if (p2Line) {
          doc.font('Garamond').fillColor('#4b5563').fontSize(coverMetaFontSize).text(p2Line, { align: 'center' });
        }
        doc.moveDown(0.9);
        doc.font('Garamond').fillColor('#4b5563').fontSize(coverMetaFontSize).text(`generated on ${timestamp}`, { align: 'center' });
        doc.fillColor('#111111');
      } else {
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
        doc.font('Garamond').fillColor('#4b5563').fontSize(coverMetaFontSize).text(`generated on ${timestamp}`, { align: 'center' });
        doc.fillColor('#111111');
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

      // Chart reference page is currently disabled globally by product decision.
      // Keep this branch explicit so it can be re-enabled cleanly later.
      if (ENABLE_CHART_REFERENCE_PAGE) {
        const hasChartReference = Boolean(String(options.chartReferencePage || '').trim() || String(options.chartReferencePageRight || '').trim());
        if (hasChartReference) {
          doc.addPage();
          renderChartReferenceText(doc, options.chartReferencePage || '', hasPlayfairBold, options.chartReferencePageRight);
        }
      }
      doc.addPage();

      const signatureBlocks: SignatureBlock[] = [];
      const cleanedChapters = options.chapters.map((chapter) => {
        const cleaned: ChapterContent = { ...chapter };

        const capture = (field: 'person1Reading' | 'person2Reading' | 'overlayReading' | 'verdict', label: string) => {
          const source = cleaned[field];
          if (!source) return;
          const extracted = extractChartSignatureFooter(source);
          cleaned[field] = extracted.body || source;
          if (extracted.signature) {
            signatureBlocks.push({
              system: chapter.system || 'western',
              label,
              signature: extracted.signature,
              dataLine: extracted.dataLine,
            });
          }
        };

        capture('person1Reading', `${options.person1.name} Signature`);
        if (options.person2) capture('person2Reading', `${options.person2.name} Signature`);
        if (options.person2) capture('overlayReading', `${options.person1.name} & ${options.person2.name} Signature`);
        capture('verdict', 'Verdict Signature');
        return cleaned;
      });

      // Body text
      for (const chapter of cleanedChapters) {
      if (chapter.person1Reading) {
          renderReadingText(doc, chapter.person1Reading, hasPlayfairBold, options.allowInferredHeadlines ?? false);
        }
        if (chapter.person2Reading) {
          renderReadingText(doc, chapter.person2Reading, hasPlayfairBold, options.allowInferredHeadlines ?? false);
        }
        if (chapter.overlayReading) {
          renderReadingText(doc, chapter.overlayReading, hasPlayfairBold, options.allowInferredHeadlines ?? false);
        }
        if (chapter.verdict) {
          renderReadingText(doc, chapter.verdict, hasPlayfairBold, options.allowInferredHeadlines ?? false);
        }
      }

      if (options.type === 'overlay') {
        // Priority 1: Use pre-computed scores from separate scoring call
        if (options.compatibilityScores && options.compatibilityScores.length > 0) {
          const rows: CompatibilityRow[] = options.compatibilityScores.map((s) => ({
            label: s.label,
            score: s.scoreTen,
            note: s.note || undefined,
          }));
          renderCompatibilitySnapshotPage(doc, rows, hasPlayfairBold);
        } else {
          // Fallback: try to extract from reading text (legacy/worker path)
          const allReadingText = cleanedChapters
            .map((c) => [c.overlayReading, c.verdict].filter(Boolean).join('\n\n'))
            .join('\n\n');
          const compatibilityRows = extractCompatibilityRows(allReadingText);
          if (compatibilityRows.length > 0) {
            renderCompatibilitySnapshotPage(doc, compatibilityRows, hasPlayfairBold);
          }
        }
      }

      if (signatureBlocks.length > 0) {
        renderSignatureGlossaryPage(doc, signatureBlocks, hasPlayfairBold);
      }

      // Footer / legal block on a dedicated page to avoid clipping/column collapse.
      doc.addPage();
      doc.font('Garamond').fontSize(10);
      const footerX = 72;
      const footerWidth = doc.page.width - 144;
      const footerTop = 120;
      const footerLines = [
        '1-in-a-billion.app',
        '',
        'Published by: SwiftBuy Solutions LLC',
        'Meydan Grandstand, 6th floor',
        'Meydan Road, Nad Al Sheba, Dubai, U.A.E.',
        '',
        'powered by: forbidden-yoga.com',
        'Program idea and concept: Michael Wogenburg',
      ];
      let footerY = footerTop;
      for (const line of footerLines) {
        if (!line) {
          footerY += 8;
          continue;
        }
        doc.text(line, footerX, footerY, { align: 'left', width: footerWidth, lineBreak: false });
        footerY += 14;
      }

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
