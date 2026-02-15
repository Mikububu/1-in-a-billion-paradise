import type { ReadingProduct, ReadingType } from '@/utils/purchaseFlow';

export type Range = {
  min: number;
  max: number;
};

export type ReadingOutputContract = {
  profileId: string;
  productType: ReadingProduct;
  readingType: ReadingType;
  marketingPromise: {
    audioMinutes?: Range;
    pages?: Range;
  };
  bundleComposition?: {
    systemReadings: number;
    finalVerdictReadings: number;
    totalReadings: number;
    finalVerdictUsesSameLengthAsSystemReadings: boolean;
  };
};

const FULL_READING_BASE = {
  // Source of truth for actual word-count is backend.
  // Frontend only keeps "marketing promise" ranges for display in offer screens.
  marketingPromise: {
    audioMinutes: { min: 32, max: 42 },
    pages: { min: 8, max: 12 },
  } as { audioMinutes: Range; pages: Range },
} as const;

const BUNDLE_16_COMPOSITION = {
  systemReadings: 15,
  finalVerdictReadings: 1,
  totalReadings: 16,
  finalVerdictUsesSameLengthAsSystemReadings: true,
} as const;

function scaleRange(range: Range, factor: number): Range {
  return {
    min: Math.round(range.min * factor),
    max: Math.round(range.max * factor),
  };
}

const CONTRACTS: Record<ReadingProduct, ReadingOutputContract> = {
  single_system: {
    profileId: 'single-system-v1',
    productType: 'single_system',
    readingType: 'individual',
    marketingPromise: FULL_READING_BASE.marketingPromise,
  },
  compatibility_overlay: {
    profileId: 'compatibility-overlay-v1',
    productType: 'compatibility_overlay',
    readingType: 'overlay',
    marketingPromise: FULL_READING_BASE.marketingPromise,
  },
  bundle_5_readings: {
    profileId: 'bundle-5-readings-v1',
    productType: 'bundle_5_readings',
    readingType: 'individual',
    marketingPromise: FULL_READING_BASE.marketingPromise,
  },
  bundle_16_readings: {
    profileId: 'bundle-16-readings-v1',
    productType: 'bundle_16_readings',
    readingType: 'overlay',
    // 15 system readings + 1 final verdict; each of those 16 uses FULL_READING_BASE length.
    marketingPromise: {
      audioMinutes: scaleRange(FULL_READING_BASE.marketingPromise.audioMinutes, BUNDLE_16_COMPOSITION.totalReadings),
      pages: scaleRange(FULL_READING_BASE.marketingPromise.pages, BUNDLE_16_COMPOSITION.totalReadings),
    },
    bundleComposition: BUNDLE_16_COMPOSITION,
  },
};

export function isReadingProduct(value: string): value is ReadingProduct {
  return value === 'single_system' ||
    value === 'compatibility_overlay' ||
    value === 'bundle_5_readings' ||
    value === 'bundle_16_readings';
}

export function getReadingOutputContract(productType: string): ReadingOutputContract | null {
  if (!isReadingProduct(productType)) return null;
  return CONTRACTS[productType];
}

export function formatMarketingLengthPromise(productType: ReadingProduct): string | null {
  const contract = getReadingOutputContract(productType);
  if (!contract) return null;

  const audio = contract.marketingPromise.audioMinutes;
  const pages = contract.marketingPromise.pages;

  if (!audio && !pages) return null;
  if (audio && pages) return `${audio.min}-${audio.max} min audio & ${pages.min}-${pages.max} pages approx`;
  if (audio) return `${audio.min}-${audio.max} min audio approx`;
  return `${pages!.min}-${pages!.max} pages approx`;
}
