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
  generatedAt: Date;
  spicyScore?: number;
  safeStableScore?: number;
  compatibilityScore?: number;
  finalVerdict?: string;
}

function buildOverlayCoverTitle(title: string): string {
  const raw = String(title || '').trim();
  if (!raw) return 'Compatibility Reading';
  const m = raw.match(/^(.+?)\s+Reading\b/i);
  if (!m?.[1]) return raw;
  return `${m[1].trim()} Reading`;
}

function cleanCoverSummarySource(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:before writing|internal arc|the_wound|the_defense|act_1_surface|act_2_beneath|act_3_reckoning|landing_temperature)\b/gi, '')
    .replace(/\b(?:chart signature|data:|output requirement|zone 1|zone 2|final output requirement)\b/gi, '')
    .replace(/\b(?:individual|overlay|verdict)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
    .replace(/[|]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:;,.!?\-]+|[\s:;,.!?\-]+$/g, '')
    .trim();
}

function buildOverlayCoverSummary(coverQuote: string | undefined, person1Name: string, person2Name: string): string {
  const p1 = String(person1Name || '').trim();
  const p2 = String(person2Name || '').trim();
  const quote = cleanCoverSummarySource(coverQuote || '');
  if (!quote) {
    return `${p1} and ${p2} enter a field of attraction, friction, and growth that asks both of them to change.`;
  }

  const hasP1 = p1 ? new RegExp(`\\b${p1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(quote) : false;
  const hasP2 = p2 ? new RegExp(`\\b${p2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(quote) : false;
  if (hasP1 && hasP2) return quote;

  // Make the cover summary explicitly about both people.
  const stripped = quote
    .replace(new RegExp(`\\b${p1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '')
    .replace(new RegExp(`\\b${p2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\W+|\W+$/g, '')
    .trim();

  if (!stripped) return `${p1} and ${p2} are entering the same weather, but not from the same door.`;
  return `${p1} and ${p2}: ${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`;
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
  if (text.length < 12 || text.length > 90) return false;
  if (/^\d/.test(text)) return false;
  if (/[,:;]$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 10) return false;
  if (/[.!?]$/.test(text)) return false;
  const upperWords = words.filter((w) => /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (upperWords / words.length >= 0.9) return true;
  if (/^THE\s+/i.test(text) && words.length >= 4) return true;
  const titleLikeWords = words.filter((w) => /^[A-Z][A-Za-z'’\-]*$/.test(w) || /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (titleLikeWords / words.length >= 0.85) return true;
  return false;
}

function splitEmbeddedHeadline(paragraph: string): { headline?: string; body: string } {
  const text = String(paragraph || '').trim().replace(/\s+/g, ' ');
  if (!text) return { body: '' };
  const stripped = text.replace(/^(?:[-–—]{2,}\s*)?[IVXLC]+\.\s*/i, '').trim();
  const mUpper = stripped.match(/^((?:THE|A|AN)\s+[A-Z0-9'’\-]+(?:\s+[A-Z0-9'’\-]+){2,})\s+([A-Z][a-z].+)$/);
  if (mUpper) {
    return {
      headline: mUpper[1].trim(),
      body: mUpper[2].trim(),
    };
  }
  const mTitle = stripped.match(/^((?:The|A|An)\s+[A-Z][a-z'’\-]+(?:\s+[A-Z][a-z'’\-]+){2,11})\s+([A-Z][a-z].+)$/);
  if (mTitle) {
    return {
      headline: mTitle[1].trim(),
      body: mTitle[2].trim(),
    };
  }
  if (isLikelySubheadline(stripped)) return { headline: stripped, body: '' };
  return { body: stripped };
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

  const wordsIn = (value: string): number => value.split(/\s+/).filter(Boolean).length;
  let wordsSinceLastHeadline = 999;
  for (const rawParagraph of paragraphs) {
    const { headline, body } = splitEmbeddedHeadline(rawParagraph);
    if (headline) {
      if (wordsSinceLastHeadline >= 80) {
        doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(10.8).fillColor('#111111');
        doc.text(headline, { align: 'left' });
        doc.moveDown(0.28);
        wordsSinceLastHeadline = 0;
      } else {
        doc.font('Garamond').fontSize(11).fillColor('#111111');
        doc.text(headline, { align: 'justify' });
        doc.moveDown(0.6);
        wordsSinceLastHeadline += wordsIn(headline);
      }
    }

    const paragraph = body;
    if (!paragraph) continue;

    if (isLikelySubheadline(paragraph)) {
      if (wordsSinceLastHeadline >= 80) {
        doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(10.8).fillColor('#111111');
        doc.text(paragraph, { align: 'left' });
        doc.moveDown(0.28);
        wordsSinceLastHeadline = 0;
      } else {
        doc.font('Garamond').fontSize(11).fillColor('#111111');
        doc.text(paragraph, { align: 'justify' });
        doc.moveDown(0.6);
        wordsSinceLastHeadline += wordsIn(paragraph);
      }
      continue;
    }

    doc.font('Garamond').fontSize(11).fillColor('#111111');
    doc.text(paragraph, { align: 'justify' });
    doc.moveDown(0.6);
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
function extractCompatibilityRows(reading: string, appendix?: string): CompatibilityRow[] {
  const text = String(reading || '');
  const appendixText = String(appendix || '');
  const explicitRows: CompatibilityRow[] = [];
  const explicitRe = /^-\s*([^:]{3,60}):\s*(\d{1,2}(?:\.\d+)?)\s*\/\s*10\s*[—-]\s*(.+)$/gmi;
  let explicitMatch: RegExpExecArray | null;
  while ((explicitMatch = explicitRe.exec(appendixText)) !== null) {
    const label = explicitMatch[1]?.trim() || '';
    const score = Number(explicitMatch[2]);
    const note = (explicitMatch[3] || '').trim();
    if (!label || !Number.isFinite(score)) continue;
    explicitRows.push({ label, score: Math.max(0, Math.min(10, score)), note });
  }
  if (explicitRows.length > 0) return explicitRows.slice(0, 8);

  const labels = [
    'Safe to Spicy',
    'Karmic Resonance',
    'Karmic Bond',
    'Daily Life',
    'Daily Life Together',
    'Toxic Relationship Potential',
    'Healing Potential',
    'Long-Term Sustainability',
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

  const left = 74;
  const right = doc.page.width - 74;
  const labelWidth = 220;
  const scoreWidth = 72;
  const gap = 12;
  const maxBar = Math.max(180, right - (left + labelWidth + gap + scoreWidth + gap));
  const barX = left + labelWidth + gap;
  const scoreX = barX + maxBar + gap;
  const pageBottom = doc.page.height - 120;
  let y = doc.y + 10;
  for (const row of rows) {
    if (y > pageBottom - 40) {
      doc.addPage();
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(18).fillColor('#7a4a12')
        .text('Compatibility Snapshot', { align: 'center' });
      doc.moveDown(0.7);
      y = 105;
    }
    doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(11).fillColor('#111111');
    const labelHeight = Math.max(14, doc.heightOfString(row.label, { width: labelWidth, align: 'left' }));
    const noteHeight = row.note
      ? doc.heightOfString(row.note, { width: right - left, align: 'left' })
      : 0;
    const requiredHeight = labelHeight + 8 + (row.note ? noteHeight + 12 : 0);
    if (y + requiredHeight > pageBottom) {
      doc.addPage();
      doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fontSize(18).fillColor('#7a4a12')
        .text('Compatibility Snapshot', { align: 'center' });
      doc.moveDown(0.7);
      y = 105;
    }
    doc.text(row.label, left, y, { width: labelWidth, align: 'left' });
    const barY = y + Math.max(1, (labelHeight - 10) / 2);
    doc.roundedRect(barX, barY, maxBar, 10, 5).lineWidth(0.8).strokeColor('#d1d5db').stroke();
    const fillW = (row.score / 10) * maxBar;
    doc.roundedRect(barX, barY, fillW, 10, 5).fillColor('#b91c1c').fill();

    doc.font('Garamond').fontSize(10).fillColor('#111111')
      .text(`${row.score.toFixed(1)}/10`, scoreX, y, { width: scoreWidth, align: 'right' });

    let nextY = y + Math.max(labelHeight, 14) + 8;
    if (row.note) {
      doc.font('Garamond').fontSize(9.5).fillColor('#4b5563')
        .text(row.note, left, nextY, { width: right - left, align: 'left' });
      nextY += noteHeight + 12;
    }
    y = nextY;
  }
  doc.x = doc.page.margins.left;
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

      const overlayMode = options.type === 'overlay' && Boolean(options.person2);
      const coverTitle = overlayMode ? buildOverlayCoverTitle(options.title) : options.title;
      doc.font('Garamond').fillColor('#7a4a12').fontSize(21).text(coverTitle, { align: 'center' });

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

      if (overlayMode && options.person2) {
        doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fillColor('#111111').fontSize(11);
        doc.text(`Person 1: ${options.person1.name}`, { align: 'center' });
        const p1Line = formatPersonCoverLine(options.person1);
        if (p1Line) {
          doc.fillColor('#4b5563').fontSize(9.5).text(p1Line, { align: 'center' });
        }
        doc.moveDown(0.9);
        doc.fillColor('#6b7280').fontSize(12).text('&', { align: 'center' });
        doc.moveDown(0.6);
        doc.fillColor('#111111').fontSize(11).text(`Person 2: ${options.person2.name}`, { align: 'center' });
        const p2Line = formatPersonCoverLine(options.person2);
        if (p2Line) {
          doc.fillColor('#4b5563').fontSize(9.5).text(p2Line, { align: 'center' });
        }
        doc.moveDown(0.9);
        doc.fillColor('#4b5563').fontSize(10).text(`generated - ${timestamp}`, { align: 'center' });
        doc.fillColor('#111111');

        const overlaySummary = buildOverlayCoverSummary(options.coverQuote, options.person1.name, options.person2.name);
        if (overlaySummary) {
          doc.moveDown(0.9);
          doc.font(hasPlayfairBold ? 'PlayfairBold' : 'Garamond').fillColor('#111111').fontSize(12.5);
          doc.text(overlaySummary, { align: 'center', lineGap: 2 });
        }
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

      // Page 2: deterministic chart overview (one or two columns). Then start prose on next page.
      const hasChartReference = Boolean(String(options.chartReferencePage || '').trim() || String(options.chartReferencePageRight || '').trim());
      if (hasChartReference) {
        doc.addPage();
        renderChartReferenceText(doc, options.chartReferencePage || '', hasPlayfairBold, options.chartReferencePageRight);
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
        const overlayText = cleanedChapters.map((c) => c.overlayReading || '').join('\n\n');
        const compatibilityRows = extractCompatibilityRows(overlayText, options.compatibilityAppendix);
        if (compatibilityRows.length > 0) {
          renderCompatibilitySnapshotPage(doc, compatibilityRows, hasPlayfairBold);
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
      doc.text('1-in-a-billion.app', footerX, footerTop, { align: 'left', width: footerWidth });
      doc.text('Published by:', footerX, doc.y + 8, { align: 'left', width: footerWidth });
      doc.text('SwiftBuy Solutions LLC', footerX, doc.y, { align: 'left', width: footerWidth });
      doc.text('Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.', footerX, doc.y, { align: 'left', width: footerWidth });
      doc.text('powered by: forbidden-yoga.com', footerX, doc.y + 8, { align: 'left', width: footerWidth });
      doc.text('Program idea and concept: Michael Wogenburg', footerX, doc.y, { align: 'left', width: footerWidth });

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
