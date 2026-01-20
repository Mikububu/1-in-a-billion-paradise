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
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
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
    
    // Body text (CHANGE HERE to adjust all PDF body text)
    body: 9.5,  // User requested smaller → change to 8.5 or 9.0
    
    // Special
    metadata: 9,
    caption: 8,
    footer: 8,
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
    paragraphGap: 12,
    sectionGap: 24,
    chapterGap: 36,
    lineHeight: 1.5,
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
    brandFontSize: 16,        // "1 in a Billion" font size
    dateFontSize: 9,          // Date font size
    titleFontSize: 12,        // System + Person name font size
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
    fontSize: 8,
    color: '#999999',
    showPageNumbers: true,
    showGeneratedDate: false,
    
    // Footer content (appears on ALL PDFs)
    content: {
      disclaimer: 'This reading is for contemplation and self-discovery.',
      copyright: '© 1 in a Billion',
      website: 'http://1-in-a-billion.app/',
      publisher: {
        name: 'SwiftBuy Solutions LLC',
        address: 'Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.',
      },
      poweredBy: 'forbidden-yoga.com',
      creator: 'Michael Wogenburg',
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
