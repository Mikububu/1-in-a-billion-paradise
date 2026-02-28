import axios from 'axios';
import { ReadingPayload, ReadingResponse, AudioGenerateResponse, BirthChart, EntitlementResponse, ProductInfo, SynastryResponse, CompatibilityScores } from '@/types/api';
import { env } from '@/config/env';
import { buildPromptLayerDirective } from '@/config/promptLayers';
import { useAuthStore } from '@/store/authStore';
import { generateLocalHookReading } from './localReadings';

const CORE_API_URL = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || env.CORE_API_URL;
const SUPABASE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL || CORE_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Supabase Edge Function path — change this in ONE place if the function ID changes on redeploy
const EDGE_FN = '/make-server-02a2a601';

// Session expiry handler
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/**
 * Returns Authorization header with the current Supabase access token.
 * Use this for raw fetch() calls that bypass the Axios coreClient.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const coreClient = axios.create({
    baseURL: CORE_API_URL,
    timeout: 20000,
});

// Automatically attach Supabase access token to every coreClient request
coreClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().session?.access_token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
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

// Add response interceptor for 401 errors to both clients
coreClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && onSessionExpired) {
            onSessionExpired();
        }
        return Promise.reject(error);
    }
);

supabaseClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && onSessionExpired) {
            onSessionExpired();
        }
        return Promise.reject(error);
    }
);

// Fallback keeps onboarding flow alive when hook endpoints are temporarily unavailable.
// NOTE: We omit `sign` so generateLocalHookReading estimates it from birthDate.
const readingFallback = (payload: ReadingPayload, type: 'sun' | 'moon' | 'rising'): ReadingResponse => ({
    reading: generateLocalHookReading({
        type,
        relationshipPreferenceScale: payload.relationshipPreferenceScale,
        birthDate: payload.birthDate,
    }),
    metadata: {
        cacheHit: false,
        generatedAt: new Date().toISOString(),
    },
});

export const readingsApi = {
    sun: async (payload: ReadingPayload): Promise<ReadingResponse> => {
        try {
            const response = await coreClient.post<ReadingResponse>('/api/reading/sun?provider=deepseek&nocache=true', payload);
            return response.data;
        } catch (error) {
            console.warn('Falling back to local Sun reading', error);
            return readingFallback(payload, 'sun');
        }
    },
    moon: async (payload: ReadingPayload): Promise<ReadingResponse> => {
        try {
            const response = await coreClient.post<ReadingResponse>('/api/reading/moon?provider=deepseek&nocache=true', payload);
            return response.data;
        } catch (error) {
            console.warn('Falling back to local Moon reading', error);
            return readingFallback(payload, 'moon');
        }
    },
    rising: async (payload: ReadingPayload): Promise<ReadingResponse> => {
        try {
            const response = await coreClient.post<ReadingResponse>('/api/reading/rising?provider=deepseek&nocache=true', payload);
            return response.data;
        } catch (error) {
            console.warn('Falling back to local Rising reading', error);
            return readingFallback(payload, 'rising');
        }
    },
};

export const audioApi = {
    generate: async (readingId: string): Promise<AudioGenerateResponse> => {
        try {
            const response = await supabaseClient.post<AudioGenerateResponse>(`${EDGE_FN}/generate-audio`, { readingId });
            return response.data;
        } catch (error) {
            console.warn('Audio fallback', error);
            return {
                audioId: readingId,
                status: 'processing',
            };
        }
    },

    // Generate TTS audio using Chatterbox (via Replicate)
    generateTTS: async (text: string, options?: {
        exaggeration?: number;
        audioUrl?: string; // Custom voice sample URL
        spokenIntro?: string;
        includeIntro?: boolean;
        timeoutMs?: number;
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
                spokenIntro: options?.spokenIntro,
                includeIntro: options?.includeIntro,
            }, {
                timeout: options?.timeoutMs ?? 240000,
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
        userId: string;
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
                userId: params.userId,
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
            const response = await supabaseClient.get<EntitlementResponse>(`${EDGE_FN}/entitlements/${userId}`);
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
            const response = await supabaseClient.post(`${EDGE_FN}/check-access`, {
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
            const response = await supabaseClient.post(`${EDGE_FN}/grant-entitlement`, {
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
            const response = await supabaseClient.get(`${EDGE_FN}/products`);
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
        user1: { name: string; birthChart: BirthChart },
        user2: { name: string; birthChart: BirthChart }
    ): Promise<{ success: boolean; compatibility?: CompatibilityScores }> => {
        try {
            const response = await supabaseClient.post(`${EDGE_FN}/calculate-synastry-scores`, {
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
            const response = await supabaseClient.post<SynastryResponse>(`${EDGE_FN}/generate-synastry-overlay`, {
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

/**
 * Create included reading job (one free reading per subscription)
 */
export async function createIncludedReading(
    userId: string,
    system: string,
    birthData: {
        id?: string;
        name: string;
        birthDate: string;
        birthTime: string;
        timezone: string;
        latitude: number;
        longitude: number;
    },
    relationshipPreferenceScale: number = 5
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
        // Auth token is attached automatically by the coreClient request interceptor
        const response = await coreClient.post('/api/jobs/v2/start', {
            type: 'extended',
            systems: [system],
            promptLayerDirective: buildPromptLayerDirective([system]),
            person1: birthData,
            relationshipPreferenceScale: Math.min(10, Math.max(1, Math.round(relationshipPreferenceScale))),
            useIncludedReading: true, // Flag: use the one included reading from subscription
        });

        return {
            success: true,
            jobId: response.data.jobId,
        };
    } catch (error: any) {
        console.error('Failed to create included reading:', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'Failed to create reading',
        };
    }
}

/**
 * Check if current user is eligible for the free included reading.
 * Returns true if they have an active subscription and haven't used their free reading yet.
 */
export async function checkIncludedReadingEligible(): Promise<boolean> {
    try {
        const accessToken = useAuthStore.getState().session?.access_token;
        if (!accessToken) return false;

        // Auth token is attached automatically by the coreClient request interceptor
        const response = await coreClient.get('/api/payments/included-reading-status');

        return response.data?.eligible === true;
    } catch (error: any) {
        console.warn('Failed to check included reading eligibility:', error?.message);
        return false;
    }
}
