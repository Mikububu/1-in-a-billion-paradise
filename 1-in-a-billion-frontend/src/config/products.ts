/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRODUCT CONFIGURATION - Single Source of Truth
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ALL pricing and output limits are defined here.
 * Nuclear = reference (1 hour max, $30). Everything scales down.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCT_NAMES = [
  'single_system',
  'complete_reading', 
  'compatibility_overlay',
  'nuclear_package',
] as const;

export type ProductName = typeof PRODUCT_NAMES[number];

export interface Product {
  name: ProductName;
  displayName: string;
  description: string;
  audioMinutes: number;
  pagesMin: number;
  pagesMax: number;
  wordCount: number;
  charCount: number;
  priceUSD: number;
  ttsCostEstimate: number;
  marginPercent: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR REFERENCE (everything scales from this)
// ═══════════════════════════════════════════════════════════════════════════

export const NUCLEAR_REFERENCE = {
  audioMinutes: 128,       // 2.1 hours
  wordCount: 32000,        // 16 API calls × 2000 words
  pagesMin: 53,
  pagesMax: 53,
  priceUSD: 108,
  ttsCostPerMinute: 0.018, // RunPod A10G: $2.34 / 128 min
  apiCalls: 16,            // 10 individual + 5 overlay + 1 verdict
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT POLICY
// ═══════════════════════════════════════════════════════════════════════════

export const OUTPUT_POLICY = {
  wordsPerPage: 250,
  wordsPerMinuteAudio: 150,
  charsPerWord: 6.5,
  maxAudioMinutes: 60,
  maxLLMTokens: 16000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS (change prices/limits here)
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCTS: Record<ProductName, Product> = {
  single_system: {
    name: 'single_system',
    displayName: 'Single System Reading',
    description: '1 person, 1 system (5 systems available)',
    audioMinutes: 13,
    pagesMin: 4,
    pagesMax: 5,
    wordCount: 2000,
    charCount: 13000,
    priceUSD: 29,
    ttsCostEstimate: 0.23,  // 13 min × $0.018/min
    marginPercent: 99,
  },
  
  complete_reading: {
    name: 'complete_reading',
    displayName: 'Complete Reading',
    description: '1 person, all 5 systems combined',
    audioMinutes: 67,
    pagesMin: 17,
    pagesMax: 17,
    wordCount: 10000,
    charCount: 65000,
    priceUSD: 79,
    ttsCostEstimate: 1.21,  // 67 min × $0.018/min
    marginPercent: 98,
  },
  
  compatibility_overlay: {
    name: 'compatibility_overlay',
    displayName: 'Two Person Overlay',
    description: '2 people, 1 system (5 systems available)',
    audioMinutes: 40,
    pagesMin: 10,
    pagesMax: 10,
    wordCount: 6000,
    charCount: 39000,
    priceUSD: 59,
    ttsCostEstimate: 0.72,  // 40 min × $0.018/min
    marginPercent: 99,
  },
  
  nuclear_package: {
    name: 'nuclear_package',
    displayName: 'Nuclear Package',
    description: '2 people, all 5 systems + all overlays + verdict',
    audioMinutes: 210,      // ~3.5 hours (actual: ~217 min verified)
    pagesMin: 90,           // ~90 pages (actual: ~130 pages)
    pagesMax: 100,
    wordCount: 32000,
    charCount: 208000,
    priceUSD: 108,
    ttsCostEstimate: 3.78,  // 210 min × $0.018/min
    marginPercent: 96,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getProductLimits(productName: ProductName): Product {
  return PRODUCTS[productName];
}

export function getAllProducts(): Product[] {
  return PRODUCT_NAMES.map(name => PRODUCTS[name]);
}

export function getPrice(productName: ProductName): number {
  return PRODUCTS[productName].priceUSD;
}

export function getWordLimit(productName: ProductName): number {
  return PRODUCTS[productName].wordCount;
}

export function getAudioLimit(productName: ProductName): number {
  return PRODUCTS[productName].audioMinutes;
}

export function getWordCountInstruction(productName: ProductName): string {
  const p = PRODUCTS[productName];
  return `Write approximately ${p.wordCount.toLocaleString()} words (${p.pagesMin}-${p.pagesMax} pages).`;
}

export function exceedsProductLimits(
  productName: ProductName,
  content: { words?: number; chars?: number; minutes?: number }
): boolean {
  const limits = PRODUCTS[productName];
  if (content.words && content.words > limits.wordCount) return true;
  if (content.chars && content.chars > limits.charCount) return true;
  if (content.minutes && content.minutes > limits.audioMinutes) return true;
  return false;
}

export function getProductTable(): string {
  return getAllProducts()
    .map(p => `${p.displayName}: $${p.priceUSD}, ${p.audioMinutes}min, ${p.wordCount} words`)
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const WORDS_PER_PAGE = OUTPUT_POLICY.wordsPerPage;
export const WORDS_PER_MINUTE = OUTPUT_POLICY.wordsPerMinuteAudio;
export const CLAUDE_MAX_PAGES = 20;

export const SYSTEM_INTRO = {
  pages: 1, words: 250, audioMinutes: 2, price: 0,
} as const;

export const SINGLE_SYSTEM = {
  pages: PRODUCTS.single_system.pagesMax,
  audioMinutes: PRODUCTS.single_system.audioMinutes,
  pdfs: 1,
  price: PRODUCTS.single_system.priceUSD,
  words: PRODUCTS.single_system.wordCount,
  generationTime: '1-2 minutes',
  apiCalls: 1,
} as const;

export const COMPLETE_READING = {
  pages: PRODUCTS.complete_reading.pagesMax,
  audioMinutes: PRODUCTS.complete_reading.audioMinutes,
  pdfs: 5, // One PDF per system
  price: PRODUCTS.complete_reading.priceUSD,
  originalPrice: PRODUCTS.single_system.priceUSD * 5,
  savings: (PRODUCTS.single_system.priceUSD * 5) - PRODUCTS.complete_reading.priceUSD,
  words: PRODUCTS.complete_reading.wordCount,
  generationTime: '3-4 minutes',
  apiCalls: 5,
} as const;

export const COMPATIBILITY_OVERLAY = {
  pages: PRODUCTS.compatibility_overlay.pagesMax,
  audioMinutes: PRODUCTS.compatibility_overlay.audioMinutes,
  pdfs: 1,
  price: PRODUCTS.compatibility_overlay.priceUSD,
  words: PRODUCTS.compatibility_overlay.wordCount,
  generationTime: '2-3 minutes',
  apiCalls: 3,  // 2 individual + 1 overlay
} as const;

export const NUCLEAR_PACKAGE = {
  // 10 individual readings (verified: ~109 min / ~11 min each)
  person1Pages: 30,        // 5 systems × ~6 pages
  person1Audio: 55,        // 5 systems × ~11 min (verified)
  person1Pdfs: 1,
  person2Pages: 30,
  person2Audio: 55,
  person2Pdfs: 1,
  // 5 overlay readings + 1 verdict (verified: ~108 min total)
  overlayPages: 40,        // 6 readings × ~7 pages
  overlayAudio: 100,       // 5 overlays (~19 min each) + verdict (~12 min)
  overlayPdfs: 1,
  // Totals (verified from actual completed jobs: 217 min)
  totalPages: PRODUCTS.nuclear_package.pagesMax,
  totalAudioMinutes: PRODUCTS.nuclear_package.audioMinutes,
  totalPdfs: 6,            // 6 chapters as separate PDFs
  price: PRODUCTS.nuclear_package.priceUSD,
  generationTime: '8-10 minutes',
  apiCalls: 16,            // 10 individual + 5 overlay + 1 verdict
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function formatAudioDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${hours}h ${mins}m`;
  }
  return `${minutes} min`;
}

export function formatPrice(price: number): string {
  return `$${price}`;
}

export function getProductSummary(product: { pages: number; audioMinutes: number; pdfs?: number }): string {
  const parts = [`${product.pages} pages`, `${formatAudioDuration(product.audioMinutes)} audio`];
  if (product.pdfs && product.pdfs > 1) parts.push(`${product.pdfs} PDFs`);
  return parts.join(' · ');
}

export function getSavingsText(savings: number): string {
  return `Save $${savings}`;
}

export const PRODUCT_STRINGS = {
  singleSystem: {
    summary: `${SINGLE_SYSTEM.pages} page PDF · ${SINGLE_SYSTEM.audioMinutes} min Audio`,
    price: formatPrice(SINGLE_SYSTEM.price),
    generationMessage: `Creating your personalized reading + audio.\n\nThis takes 1-2 minutes.\nYou can close the app and check back later!`,
  },
  completeReading: {
    summary: `${COMPLETE_READING.pages} pages · ${formatAudioDuration(COMPLETE_READING.audioMinutes)} audio`,
    price: formatPrice(COMPLETE_READING.price),
    originalPrice: formatPrice(COMPLETE_READING.originalPrice),
    savings: getSavingsText(COMPLETE_READING.savings),
    meta: `${COMPLETE_READING.pages} pages · ${formatAudioDuration(COMPLETE_READING.audioMinutes)} · Save $${COMPLETE_READING.savings}`,
  },
  compatibilityOverlay: {
    summary: `${COMPATIBILITY_OVERLAY.pages} pages · ${COMPATIBILITY_OVERLAY.audioMinutes} min audio`,
    price: formatPrice(COMPATIBILITY_OVERLAY.price),
  },
  nuclearPackage: {
    personSummary: `${NUCLEAR_PACKAGE.person1Pages} pages · ${formatAudioDuration(NUCLEAR_PACKAGE.person1Audio)} audio`,
    overlaySummary: `${NUCLEAR_PACKAGE.overlayPages} pages · ${formatAudioDuration(NUCLEAR_PACKAGE.overlayAudio)} audio`,
    totalSummary: `${NUCLEAR_PACKAGE.totalPages} pages · ${formatAudioDuration(NUCLEAR_PACKAGE.totalAudioMinutes)} audio`,
    price: formatPrice(NUCLEAR_PACKAGE.price),
    meta: `${NUCLEAR_PACKAGE.totalPages} pages · ${formatAudioDuration(NUCLEAR_PACKAGE.totalAudioMinutes)} audio`,
  },
} as const;

export type SystemType = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'all';

export const SYSTEM_PRICES: Record<SystemType, number> = {
  western: SINGLE_SYSTEM.price,
  vedic: SINGLE_SYSTEM.price,
  human_design: SINGLE_SYSTEM.price,
  gene_keys: SINGLE_SYSTEM.price,
  kabbalah: SINGLE_SYSTEM.price,
  all: PRODUCTS.complete_reading.priceUSD, // Bundle price
};
