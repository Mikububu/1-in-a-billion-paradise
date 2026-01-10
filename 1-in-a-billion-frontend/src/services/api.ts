import axios from 'axios';
import { ReadingPayload, ReadingResponse, MatchPreviewResponse, MatchDetailResponse, ProfileSnapshot, AudioGenerateResponse, BirthChart, EntitlementResponse, ProductInfo, SynastryResponse, CompatibilityScores } from '@/types/api';
import { generateLocalHookReading } from './localReadings';
import { sampleMatchDetails, sampleMatches } from '@/data/sampleMatches';

import { env } from '@/config/env';

const CORE_API_URL = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || env.CORE_API_URL;
const SUPABASE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL || CORE_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const coreClient = axios.create({
  baseURL: CORE_API_URL,
  timeout: 20000,
});

const supabaseClient = axios.create({
  baseURL: SUPABASE_FUNCTION_URL,
  timeout: 60000, // Longer timeout for AI-generated content
  headers: SUPABASE_ANON_KEY
    ? {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    }
    : undefined,
});

const extractPayload = (snapshot: ProfileSnapshot): ReadingPayload => {
  const { currentCity, ...readingPayload } = snapshot;
  return readingPayload;
};

// Fixed: Empty sign triggers UI fallback to '—' instead of long "To be calculated" text
const readingFallback = (payload: ReadingPayload, type: 'sun' | 'moon' | 'rising'): ReadingResponse => ({
  reading: generateLocalHookReading({
    type,
    sign: '',
    relationshipIntensity: payload.relationshipIntensity,
    relationshipMode: payload.relationshipMode,
  }),
  metadata: {
    cacheHit: false,
    generatedAt: new Date().toISOString(),
  },
});

export const readingsApi = {
  sun: async (payload: ReadingPayload): Promise<ReadingResponse> => {
    try {
      const response = await coreClient.post<ReadingResponse>('/api/reading/sun', payload);
      return response.data;
    } catch (error) {
      console.warn('Falling back to local Sun reading', error);
      return readingFallback(payload, 'sun');
    }
  },
  moon: async (payload: ReadingPayload): Promise<ReadingResponse> => {
    try {
      const response = await coreClient.post<ReadingResponse>('/api/reading/moon', payload);
      return response.data;
    } catch (error) {
      console.warn('Falling back to local Moon reading', error);
      return readingFallback(payload, 'moon');
    }
  },
  rising: async (payload: ReadingPayload): Promise<ReadingResponse> => {
    try {
      const response = await coreClient.post<ReadingResponse>('/api/reading/rising', payload);
      return response.data;
    } catch (error) {
      console.warn('Falling back to local Rising reading', error);
      return readingFallback(payload, 'rising');
    }
  },
};

export const matchesApi = {
  // Register user for real matching
  registerForMatching: async (
    userId: string,
    name: string,
    snapshot: ProfileSnapshot,
    birthChart?: BirthChart
  ): Promise<{ success: boolean; userId: string; hasChart: boolean }> => {
    try {
      const response = await supabaseClient.post('/make-server-02a2a601/register-for-matching', {
        userId,
        name,
        age: 25, // Default, can be updated later
        city: snapshot.currentCity?.name || 'Unknown',
        birthData: {
          birthDate: snapshot.birthDate,
          birthTime: snapshot.birthTime,
          birthPlace: snapshot.currentCity?.name || 'Unknown',
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          timezone: snapshot.timezone,
        },
        birthChart,
        relationshipIntensity: snapshot.relationshipIntensity,
        relationshipMode: snapshot.relationshipMode,
        primaryLanguage: snapshot.primaryLanguage,
        secondaryLanguage: snapshot.secondaryLanguage,
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to register for matching', error);
      return { success: false, userId, hasChart: false };
    }
  },

  // Get matches using real matching algorithm
  getMatches: async (userId: string, limit?: number): Promise<MatchPreviewResponse> => {
    try {
      const response = await supabaseClient.post<MatchPreviewResponse>('/make-server-02a2a601/get-matches', {
        userId,
        limit: limit || 10,
      });
      return response.data;
    } catch (error) {
      console.warn('Get matches fallback', error);
      return {
        matches: sampleMatches,
        lastUpdated: new Date().toISOString(),
      };
    }
  },

  // Legacy preview endpoint (for backwards compatibility)
  preview: async (snapshot: ProfileSnapshot): Promise<MatchPreviewResponse> => {
    try {
      const payload = extractPayload(snapshot);
      const response = await supabaseClient.post<MatchPreviewResponse>('/make-server-02a2a601/match-preview', payload);
      return response.data;
    } catch (error) {
      console.warn('Preview fallback', error);
      return {
        matches: sampleMatches,
        lastUpdated: new Date().toISOString(),
      };
    }
  },

  // Get match detail with real compatibility data
  getDetail: async (userId: string, matchedUserId: string): Promise<MatchDetailResponse> => {
    try {
      const response = await supabaseClient.post<MatchDetailResponse>('/make-server-02a2a601/get-match-detail', {
        userId,
        matchedUserId,
      });
      return response.data;
    } catch (error) {
      console.warn('Match detail fallback', error);
      return {
        match: sampleMatchDetails[matchedUserId] ?? sampleMatchDetails['m-001'],
      };
    }
  },

  // Legacy detail endpoint (for backwards compatibility)
  detail: async (matchId: string, snapshot: ProfileSnapshot): Promise<MatchDetailResponse> => {
    try {
      const payload = extractPayload(snapshot);
      const response = await supabaseClient.post<MatchDetailResponse>('/make-server-02a2a601/match-detail', { ...payload, matchId });
      return response.data;
    } catch (error) {
      console.warn('Detail fallback', error);
      return {
        match: sampleMatchDetails[matchId] ?? sampleMatchDetails['m-001'],
      };
    }
  },
};

export const audioApi = {
  generate: async (readingId: string): Promise<AudioGenerateResponse> => {
    try {
      const response = await supabaseClient.post<AudioGenerateResponse>('/make-server-02a2a601/generate-audio', { readingId });
      return response.data;
    } catch (error) {
      console.warn('Audio fallback', error);
      return {
        audioId: readingId,
        status: 'processing',
      };
    }
  },

  // Generate TTS audio using Chatterbox (via RunPod)
  generateTTS: async (text: string, options?: {
    exaggeration?: number;
    audioUrl?: string; // Custom voice sample URL
  }): Promise<{
    success: boolean;
    audioBase64?: string;
    audioUrl?: string;
    durationSeconds?: number;
    provider?: string;
    error?: string;
  }> => {
    try {
      const response = await coreClient.post('/api/audio/generate-tts', {
        text,
        provider: 'chatterbox', // Always use Chatterbox (cheapest + voice cloning)
        exaggeration: options?.exaggeration ?? 0.5,
        audioUrl: options?.audioUrl && options.audioUrl.length > 0 ? options.audioUrl : undefined, // For custom voice cloning
      }, {
        timeout: 240000, // 4 minute timeout (RunPod cold start ~30s + chunked generation + network)
      });
      return response.data;
    } catch (error: any) {
      console.warn('TTS generation failed:', error.message);
      return {
        success: false,
        error: error.message || 'TTS generation failed',
      };
    }
  },

  // Generate hook audio - backend stores in Supabase Storage, returns URL
  generateHookAudio: async (params: {
    text: string;
    userId?: string; // Optional: if not provided, uses temp storage
    type: 'sun' | 'moon' | 'rising';
    exaggeration?: number;
    audioUrl?: string;
  }): Promise<{
    success: boolean;
    audioUrl?: string;
    storagePath?: string;
    durationSeconds?: number;
    format?: string;
    sizeBytes?: number;
    error?: string;
  }> => {
    const startTime = Date.now();    
    try {
      const response = await coreClient.post('/api/audio/hook-audio/generate', {
        text: params.text,
        userId: params.userId, // Optional - backend will use temp storage if not provided
        type: params.type,
        exaggeration: params.exaggeration ?? 0.3,
        audioUrl: params.audioUrl,
      }, {
        timeout: 240000, // 4 minute timeout
      });
      
      const duration = Date.now() - startTime;      
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;      
      console.warn('Hook audio generation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// ============================================
// ENTITLEMENTS API
// ============================================

export const entitlementsApi = {
  // Get user's active entitlements
  getEntitlements: async (userId: string): Promise<EntitlementResponse> => {
    try {
      const response = await supabaseClient.get<EntitlementResponse>(`/make-server-02a2a601/entitlements/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to get entitlements', error);
      return {
        success: false,
        entitlements: [],
        activeProducts: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  },

  // Check if user has access to a feature
  checkAccess: async (
    userId: string,
    feature: 'audio' | 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'synastry'
  ): Promise<{ allowed: boolean; requiredProduct?: string; productInfo?: ProductInfo }> => {
    try {
      const response = await supabaseClient.post('/make-server-02a2a601/check-access', {
        userId,
        feature,
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to check access', error);
      return { allowed: false };
    }
  },

  // Grant entitlement after successful IAP
  grantEntitlement: async (
    userId: string,
    productId: string,
    platform: 'ios' | 'android' | 'web',
    transactionId: string,
    receiptData?: string
  ): Promise<{ success: boolean; entitlement?: object }> => {
    try {
      const response = await supabaseClient.post('/make-server-02a2a601/grant-entitlement', {
        userId,
        productId,
        platform,
        transactionId,
        receiptData,
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to grant entitlement', error);
      return { success: false };
    }
  },

  // Get available products
  getProducts: async (): Promise<{ products: Array<ProductInfo & { id: string }> }> => {
    try {
      const response = await supabaseClient.get('/make-server-02a2a601/products');
      return response.data;
    } catch (error) {
      console.warn('Failed to get products', error);
      return { products: [] };
    }
  },
};

// ============================================
// SYNASTRY (DEEP OVERLAY) API
// ============================================

export const synastryApi = {
  // Calculate compatibility scores (free)
  calculateScores: async (
    user1: { name: string; birthChart: BirthChart; relationshipIntensity?: number; relationshipMode?: string },
    user2: { name: string; birthChart: BirthChart; relationshipIntensity?: number; relationshipMode?: string }
  ): Promise<{ success: boolean; compatibility?: CompatibilityScores }> => {
    try {
      const response = await supabaseClient.post('/make-server-02a2a601/calculate-synastry-scores', {
        user1,
        user2,
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to calculate synastry scores', error);
      return { success: false };
    }
  },

  // Generate deep synastry overlay (paid)
  generateOverlay: async (
    userId: string,
    user1: { name: string; birthChart: BirthChart },
    user2: { name: string; birthChart: BirthChart },
    relationshipPreference?: string,
    skipEntitlementCheck?: boolean
  ): Promise<SynastryResponse> => {
    try {
      const response = await supabaseClient.post<SynastryResponse>('/make-server-02a2a601/generate-synastry-overlay', {
        userId,
        user1,
        user2,
        relationshipPreference,
        skipEntitlementCheck,
      });
      return response.data;
    } catch (error: any) {
      console.warn('Failed to generate synastry overlay', error);

      // Check if it's an entitlement error
      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'requires_purchase',
          requiredProduct: error.response.data.requiredProduct,
          productInfo: error.response.data.productInfo,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to generate overlay',
      };
    }
  },
};
