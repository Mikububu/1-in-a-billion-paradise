/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRODUCT CONFIGURATION - Single Source of Truth
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PRICING LOGIC:
 * ─────────────────────────────────────────────────────────────────────────────
 * Change ONLY the NUCLEAR_PRICE below - everything else auto-calculates!
 * 
 * Nuclear Package = 16 API calls (10 individual + 5 overlay + 1 verdict)
 * Nuclear is sold at 50% off → $108 = 16 × single_price × 0.50
 * Therefore: single_price = $108 / 8 = $13.50
 * 
 * PRODUCT          | API CALLS | CALCULATION              | PRICE
 * ─────────────────|───────────|──────────────────────────|────────
 * single_system    | 1         | base_price               | $14
 * complete_reading | 5         | 5 × base × 50% off       | $35
 * compatibility    | 3         | 3 × base (no discount)   | $42
 * nuclear_package  | 16        | 16 × base × 50% off      | $108
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 THE ONLY VARIABLE YOU NEED TO CHANGE
// ═══════════════════════════════════════════════════════════════════════════

export const NUCLEAR_PRICE = 108; // Change this to adjust all prices

// ═══════════════════════════════════════════════════════════════════════════
// PRICING CONSTANTS (derived from NUCLEAR_PRICE)
// ═══════════════════════════════════════════════════════════════════════════

const BUNDLE_DISCOUNT = 0.50; // 50% off for complete_reading and nuclear_package
const NUCLEAR_API_CALLS = 16; // 10 individual + 5 overlay + 1 verdict
const COMPLETE_API_CALLS = 5; // 5 systems for 1 person
const OVERLAY_API_CALLS = 3;  // 2 individual + 1 overlay comparison

// Base price per API call (derived from nuclear)
// Nuclear = 16 calls at 50% off = $108 → 16 × base × 0.50 = 108 → base = 108/8 = $13.50
const BASE_PRICE_PER_CALL = NUCLEAR_PRICE / (NUCLEAR_API_CALLS * BUNDLE_DISCOUNT);

// Calculated prices
const SINGLE_PRICE = Math.round(BASE_PRICE_PER_CALL);                                    // $14
const COMPLETE_PRICE = Math.round(COMPLETE_API_CALLS * BASE_PRICE_PER_CALL * BUNDLE_DISCOUNT); // $34
const OVERLAY_PRICE = Math.round(OVERLAY_API_CALLS * BASE_PRICE_PER_CALL);               // $41

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT SCALING (minutes/pages per API call)
// ═══════════════════════════════════════════════════════════════════════════

const MINUTES_PER_CALL = 13;  // ~13 min audio per API call
const PAGES_PER_CALL = 5;     // ~5 pages per API call
const WORDS_PER_CALL = 2000;  // ~2000 words per API call

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
  fullPriceUSD: number;  // Price before discount
  savingsUSD: number;    // Amount saved
  discountPercent: number;
  apiCalls: number;
  ttsCostEstimate: number;
  marginPercent: number;
}

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
// PRODUCTS (auto-calculated from NUCLEAR_PRICE)
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCTS: Record<ProductName, Product> = {
  single_system: {
    name: 'single_system',
    displayName: 'Single System Reading',
    description: '1 person, 1 system (5 systems available)',
    audioMinutes: 1 * MINUTES_PER_CALL,           // 13 min
    pagesMin: 1 * PAGES_PER_CALL,                 // 5 pages
    pagesMax: 1 * PAGES_PER_CALL,
    wordCount: 1 * WORDS_PER_CALL,                // 2000 words
    charCount: 1 * WORDS_PER_CALL * 6.5,          // ~13000 chars
    priceUSD: SINGLE_PRICE,                       // $14
    fullPriceUSD: SINGLE_PRICE,                   // No discount
    savingsUSD: 0,
    discountPercent: 0,
    apiCalls: 1,
    ttsCostEstimate: 1 * MINUTES_PER_CALL * 0.018,
    marginPercent: 99,
  },
  
  complete_reading: {
    name: 'complete_reading',
    displayName: 'Complete Reading',
    description: '1 person, all 5 systems combined (50% off)',
    audioMinutes: COMPLETE_API_CALLS * MINUTES_PER_CALL,    // 65 min
    pagesMin: COMPLETE_API_CALLS * PAGES_PER_CALL,          // 25 pages
    pagesMax: COMPLETE_API_CALLS * PAGES_PER_CALL,
    wordCount: COMPLETE_API_CALLS * WORDS_PER_CALL,         // 10000 words
    charCount: COMPLETE_API_CALLS * WORDS_PER_CALL * 6.5,
    priceUSD: COMPLETE_PRICE,                               // $34
    fullPriceUSD: COMPLETE_API_CALLS * SINGLE_PRICE,        // $70
    savingsUSD: (COMPLETE_API_CALLS * SINGLE_PRICE) - COMPLETE_PRICE,  // $36
    discountPercent: 50,
    apiCalls: COMPLETE_API_CALLS,
    ttsCostEstimate: COMPLETE_API_CALLS * MINUTES_PER_CALL * 0.018,
    marginPercent: 98,
  },
  
  compatibility_overlay: {
    name: 'compatibility_overlay',
    displayName: 'Compatibility Overlay',
    description: '2 people, 1 system (no discount)',
    audioMinutes: OVERLAY_API_CALLS * MINUTES_PER_CALL,     // 39 min
    pagesMin: OVERLAY_API_CALLS * PAGES_PER_CALL,           // 15 pages
    pagesMax: OVERLAY_API_CALLS * PAGES_PER_CALL,
    wordCount: OVERLAY_API_CALLS * WORDS_PER_CALL,          // 6000 words
    charCount: OVERLAY_API_CALLS * WORDS_PER_CALL * 6.5,
    priceUSD: OVERLAY_PRICE,                                // $41
    fullPriceUSD: OVERLAY_PRICE,                            // No discount
    savingsUSD: 0,
    discountPercent: 0,
    apiCalls: OVERLAY_API_CALLS,
    ttsCostEstimate: OVERLAY_API_CALLS * MINUTES_PER_CALL * 0.018,
    marginPercent: 99,
  },
  
  nuclear_package: {
    name: 'nuclear_package',
    displayName: 'Nuclear Package',
    description: '2 people, all 5 systems + overlays + verdict (50% off)',
    audioMinutes: NUCLEAR_API_CALLS * MINUTES_PER_CALL,     // 208 min (~3.5 hours)
    pagesMin: NUCLEAR_API_CALLS * PAGES_PER_CALL,           // 80 pages
    pagesMax: NUCLEAR_API_CALLS * PAGES_PER_CALL + 20,      // ~100 pages
    wordCount: NUCLEAR_API_CALLS * WORDS_PER_CALL,          // 32000 words
    charCount: NUCLEAR_API_CALLS * WORDS_PER_CALL * 6.5,
    priceUSD: NUCLEAR_PRICE,                                // $108
    fullPriceUSD: NUCLEAR_API_CALLS * SINGLE_PRICE,         // $224
    savingsUSD: (NUCLEAR_API_CALLS * SINGLE_PRICE) - NUCLEAR_PRICE,  // $116
    discountPercent: 50,
    apiCalls: NUCLEAR_API_CALLS,
    ttsCostEstimate: NUCLEAR_API_CALLS * MINUTES_PER_CALL * 0.018,
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
  pdfs: 5,
  price: PRODUCTS.complete_reading.priceUSD,
  originalPrice: PRODUCTS.complete_reading.fullPriceUSD,
  savings: PRODUCTS.complete_reading.savingsUSD,
  words: PRODUCTS.complete_reading.wordCount,
  generationTime: '3-4 minutes',
  apiCalls: COMPLETE_API_CALLS,
} as const;

export const COMPATIBILITY_OVERLAY = {
  pages: PRODUCTS.compatibility_overlay.pagesMax,
  audioMinutes: PRODUCTS.compatibility_overlay.audioMinutes,
  pdfs: 1,
  price: PRODUCTS.compatibility_overlay.priceUSD,
  words: PRODUCTS.compatibility_overlay.wordCount,
  generationTime: '2-3 minutes',
  apiCalls: OVERLAY_API_CALLS,
} as const;

export const NUCLEAR_PACKAGE = {
  // Person 1: 5 individual readings
  person1Pages: 5 * PAGES_PER_CALL,
  person1Audio: 5 * MINUTES_PER_CALL,
  person1Pdfs: 1,
  // Person 2: 5 individual readings
  person2Pages: 5 * PAGES_PER_CALL,
  person2Audio: 5 * MINUTES_PER_CALL,
  person2Pdfs: 1,
  // 5 overlay readings + 1 verdict = 6 calls
  overlayPages: 6 * PAGES_PER_CALL,
  overlayAudio: 6 * MINUTES_PER_CALL,
  overlayPdfs: 1,
  // Totals
  totalPages: PRODUCTS.nuclear_package.pagesMax,
  totalAudioMinutes: PRODUCTS.nuclear_package.audioMinutes,
  totalPdfs: 6,
  price: PRODUCTS.nuclear_package.priceUSD,
  fullPrice: PRODUCTS.nuclear_package.fullPriceUSD,
  savings: PRODUCTS.nuclear_package.savingsUSD,
  generationTime: '8-10 minutes',
  apiCalls: NUCLEAR_API_CALLS,
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
    fullPrice: formatPrice(NUCLEAR_PACKAGE.fullPrice),
    savings: getSavingsText(NUCLEAR_PACKAGE.savings),
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
  all: PRODUCTS.complete_reading.priceUSD,
};

// ═══════════════════════════════════════════════════════════════════════════
// PRICING SUMMARY (for reference)
// ═══════════════════════════════════════════════════════════════════════════
// 
// With NUCLEAR_PRICE = $108:
// ┌─────────────────────┬───────┬────────────┬─────────┬─────────┬──────────┐
// │ Product             │ Calls │ Full Price │ Discount│ Price   │ Savings  │
// ├─────────────────────┼───────┼────────────┼─────────┼─────────┼──────────┤
// │ single_system       │ 1     │ $14        │ 0%      │ $14     │ -        │
// │ complete_reading    │ 5     │ $70        │ 50%     │ $34     │ $36      │
// │ compatibility_overlay│ 3    │ $41        │ 0%      │ $41     │ -        │
// │ nuclear_package     │ 16    │ $224       │ 50%     │ $108    │ $116     │
// └─────────────────────┴───────┴────────────┴─────────┴─────────┴──────────┘
//
// To change pricing: Just update NUCLEAR_PRICE at the top!
// Example: NUCLEAR_PRICE = 150 would make single = $19, complete = $47, etc.
// ═══════════════════════════════════════════════════════════════════════════
