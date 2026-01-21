/**
 * SINGLE SOURCE OF TRUTH for PDF Layout & Styling
 * 
 * Change values here to update ALL PDFs system-wide.
 * No need to hunt through pdfGenerator.ts for magic numbers.
 */

export const PDF_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  pageSize: 'A4' as const,
  margins: {
    // Phone-first readable A4
    top: 56,
    // Large bottom margin to reserve multi-line legal footer (prevents clipping)
    bottom: 90,
    left: 56,
    right: 56,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ─────────────────────────────────────────────────────────────────────────
  fonts: {
    // Headings
    title: 24,
    chapterTitle: 18,
    sectionHeading: 14,
    subheading: 12,
    
    // Body text (keep compact; avoid giant spacing from justification)
    body: 9.5,
    
    // Special
    metadata: 9,
    caption: 8,
    footer: 7.5,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COLORS
  // ─────────────────────────────────────────────────────────────────────────
  colors: {
    primary: '#1a1a1a',
    secondary: '#666666',
    accent: '#C4A484',
    divider: '#E5E5E5',
    background: '#FFFFFF',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPACING
  // ─────────────────────────────────────────────────────────────────────────
  spacing: {
    // PDFKit uses `lineGap` rather than true line-height.
    // Keep these as semantic spacing knobs used by pdfGenerator.
    paragraphGap: 8,
    sectionGap: 18,
    chapterGap: 26,
    lineHeight: 1.45,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IMAGES
  // ─────────────────────────────────────────────────────────────────────────
  images: {
    portraitWidth: 100,
    portraitHeight: 100,
    coupleImageWidth: 200,
    coupleImageMaxHeight: 150,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER (First page only)
  // Centered "1 in a Billion" brand name + date (NO Swiss Ephemeris text)
  // ─────────────────────────────────────────────────────────────────────────
  header: {
    show: true,
    brandFontSize: 14,        // "1 in a Billion" font size
    dateFontSize: 9,          // Date font size
    titleFontSize: 13,        // System + Person name font size
    brandColor: '#000000',
    dateColor: '#666666',
    titleColor: '#000000',
    
    // First page header (date display)
    firstPage: {
      showDate: true,
      showBrandCentered: true,  // "1 in a Billion" centered at top
      dateFormat: { year: 'numeric', month: 'long', day: 'numeric' } as Intl.DateTimeFormatOptions,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  footer: {
    show: true,
    fontSize: 7.5,
    color: '#666666',
    showPageNumbers: true,
    showGeneratedDate: false,
    
    // Footer content (appears on ALL PDFs)
    content: {
      website: 'http://1-in-a-billion.app/',
      publisher: {
        name: 'SwiftBuy Solutions LLC',
        address: 'Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.',
      },
      poweredBy: 'forbidden-yoga.com',
      programIdeaAndConcept: 'Michael Wogenburg',
      copyright: '© 1 in a Billion',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────
  metadata: {
    author: '1 in a Billion',
    creator: '1 in a Billion Reading System',
    producer: 'PDFKit',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VERSION
  // ─────────────────────────────────────────────────────────────────────────
  version: '1.0',
} as const;

/**
 * Helper to get font size with optional multiplier
 * Usage: fontSize('body') or fontSize('body', 1.2) for 20% larger
 */
export function fontSize(key: keyof typeof PDF_CONFIG.fonts, multiplier: number = 1): number {
  return PDF_CONFIG.fonts[key] * multiplier;
}

/**
 * Helper to get color
 */
export function color(key: keyof typeof PDF_CONFIG.colors): string {
  return PDF_CONFIG.colors[key];
}
