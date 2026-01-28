import { CityOption, HookReading, LanguageOption, RelationshipMode } from './forms';
import { OutputLanguage } from '@/config/languages';

// Re-export for convenience
export type { OutputLanguage };

export type BirthDetailsPayload = {
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
};

export type ReadingPayload = BirthDetailsPayload & {
  relationshipIntensity: number;
  relationshipMode: RelationshipMode;
  primaryLanguage: LanguageOption['code'];      // User's spoken language
  secondaryLanguage?: LanguageOption['code'];
  languageImportance: number;
  outputLanguage?: OutputLanguage;              // Language for generated content
};

export type ProfileSnapshot = ReadingPayload & {
  currentCity?: CityOption;
};

export type ReadingResponse = {
  reading: HookReading;
  placements?: {
    sunSign: string;
    sunDegree?: string;
    moonSign: string;
    moonDegree?: string;
    risingSign: string;
    risingDegree?: string;
  };
  metadata: {
    cacheHit: boolean;
    generatedAt: string;
    outputLanguage?: OutputLanguage;            // Track what language was used
  };
};

export type MatchCard = {
  id: string;
  name: string;
  age: number;
  city: string;
  score: number;
  tags: string[];
  photoUrl?: string;
  fitSummary: string;
};

export type MatchDetail = MatchCard & {
  fitCards: string[];
  watchouts: string[];
  firstMove: string;
  audio?: {
    id: string;
    status: 'locked' | 'processing' | 'ready';
    durationSeconds?: number;
    url?: string;
  };
};

export type MatchPreviewResponse = {
  matches: MatchCard[];
  lastUpdated: string;
  fromCache?: boolean;
};

export type MatchDetailResponse = {
  match: MatchDetail;
};

export type AudioGenerateResponse = {
  audioId: string;
  status: 'processing' | 'ready';
};

// ============================================
// BIRTH CHART TYPES
// ============================================

export type BirthChart = {
  sunSign: string;
  sunDegree: string;
  sunHouse?: number;
  sunDescription?: string;
  sunDetailedDescription?: string;
  moonSign: string;
  moonDegree: string;
  moonHouse: number;
  moonDescription?: string;
  moonDetailedDescription?: string;
  risingSign: string;
  risingDegree: string;
  risingDescription?: string;
  risingDetailedDescription?: string;
  venusSign: string;
  venusDegree: string;
  venusHouse: number;
  venusDescription?: string;
  introduction?: string;
  preferenceAlignment?: {
    naturalStyle: string;
    statedPreference: string;
    alignment: string;
    analysis: string;
  };
};

// ============================================
// ENTITLEMENT TYPES
// ============================================

export type ProductId =
  | 'audio_narration'
  | 'extended_western'
  | 'extended_vedic'
  | 'extended_human_design'
  | 'extended_gene_keys'
  | 'extended_kabbalah'
  | 'all_systems_bundle'
  | 'synastry_overlay'
  | 'complete_package';

export type Entitlement = {
  id: string;
  userId: string;
  productId: ProductId;
  purchaseDate: string;
  expiresAt?: string;
  platform: 'ios' | 'android' | 'web';
  transactionId: string;
  isActive: boolean;
  createdAt: string;
};

export type EntitlementResponse = {
  success: boolean;
  entitlements: Entitlement[];
  activeProducts: ProductId[];
  lastUpdated: string;
};

export type ProductInfo = {
  name: string;
  price: number;
  description: string;
  permanent: boolean;
};

// ============================================
// SYNASTRY TYPES
// ============================================

export type CompatibilityScores = {
  overallScore: number;
  venusHarmony: number;
  moonConnection: number;
  preferenceAlignment: number;
  description: string;
};

export type SynastryReading = {
  opening: string;
  coreSynastryAnalysis: string;
  venusAndMarsDeepDive: string;
  relationshipGuidance: string;
};

export type SynastryResponse = {
  success: boolean;
  reading?: SynastryReading;
  generatedAt?: string;
  error?: string;
  requiredProduct?: ProductId;
  productInfo?: ProductInfo;
};

// ============================================
// JOB TYPES
// ============================================

export type JobParams = {
  person1: {
    id: string;
    name: string;
  };
  person2?: {
    id: string;
    name: string;
  };
  systems: string[];
  outputLanguage?: OutputLanguage;
};
