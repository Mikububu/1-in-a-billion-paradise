/**
 * SUBSCRIPTION STORE
 * 
 * Manages user subscription state with Zustand + persistence.
 * Tracks tier, usage limits, and handles upsell triggers.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    SubscriptionTier,
    SubscriptionState,
    DEFAULT_SUBSCRIPTION_STATE,
    SUBSCRIPTION_TIERS,
    UpsellTrigger,
    canAddPerson,
    canGenerateDeepReading,
    canGenerateSynastry,
} from '@/config/subscriptions';

type SubscriptionStore = SubscriptionState & {
    // Actions
    setTier: (tier: SubscriptionTier) => void;
    activateSubscription: (productId: string, expiresAt: string) => void;
    cancelSubscription: () => void;

    // Usage tracking
    incrementDeepReadings: () => void;
    incrementSynastry: () => void;
    resetMonthlyUsage: () => void;

    // Permission checks
    canAddPerson: (currentCount: number) => boolean;
    canGenerateDeepReading: () => boolean;
    canGenerateSynastry: () => boolean;
    canDownloadPDF: () => boolean;
    hasPriorityQueue: () => boolean;

    // Upsell
    shouldShowUpsell: (trigger: UpsellTrigger) => boolean;
    getUpsellForTrigger: (trigger: UpsellTrigger) => { show: boolean; suggestedTier: SubscriptionTier };

    // Debug/dev
    forceSetTier: (tier: SubscriptionTier) => void; // For testing
    reset: () => void;
};

export const useSubscriptionStore = create<SubscriptionStore>()(
    persist(
        (set, get) => ({
            ...DEFAULT_SUBSCRIPTION_STATE,

            // Set tier
            setTier: (tier) => {
                set({ tier });
            },

            // Activate subscription from purchase
            activateSubscription: (productId, expiresAt) => {
                // Find tier from product ID
                let tier: SubscriptionTier = 'free';
                for (const [t, product] of Object.entries(SUBSCRIPTION_TIERS)) {
                    if (product.appleProductId === productId || product.googleProductId === productId) {
                        tier = t as SubscriptionTier;
                        break;
                    }
                }

                set({
                    tier,
                    isActive: true,
                    expiresAt,
                    productId,
                    purchaseDate: new Date().toISOString(),
                });
            },

            // Cancel subscription
            cancelSubscription: () => {
                set({
                    tier: 'free',
                    isActive: false,
                    expiresAt: null,
                    productId: null,
                });
            },

            // Increment deep readings used this month
            incrementDeepReadings: () => {
                const state = get();
                // Check if we need to reset monthly counter
                const resetDate = new Date(state.monthResetDate);
                const now = new Date();
                if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
                    set({ monthlyDeepReadings: 1, monthlySynastry: 0, monthResetDate: now.toISOString() });
                } else {
                    set({ monthlyDeepReadings: state.monthlyDeepReadings + 1 });
                }
            },

            // Increment synastry used this month
            incrementSynastry: () => {
                const state = get();
                const resetDate = new Date(state.monthResetDate);
                const now = new Date();
                if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
                    set({ monthlyDeepReadings: 0, monthlySynastry: 1, monthResetDate: now.toISOString() });
                } else {
                    set({ monthlySynastry: state.monthlySynastry + 1 });
                }
            },

            // Reset monthly usage (called at month boundary)
            resetMonthlyUsage: () => {
                set({
                    monthlyDeepReadings: 0,
                    monthlySynastry: 0,
                    monthResetDate: new Date().toISOString(),
                });
            },

            // Permission checks
            canAddPerson: (currentCount) => {
                const tier = get().tier;
                return canAddPerson(tier, currentCount);
            },

            canGenerateDeepReading: () => {
                const state = get();
                return canGenerateDeepReading(state.tier, state.monthlyDeepReadings);
            },

            canGenerateSynastry: () => {
                const state = get();
                return canGenerateSynastry(state.tier, state.monthlySynastry);
            },

            canDownloadPDF: () => {
                const tier = get().tier;
                return SUBSCRIPTION_TIERS[tier].limits.pdfEnabled;
            },

            hasPriorityQueue: () => {
                const tier = get().tier;
                return SUBSCRIPTION_TIERS[tier].limits.priorityQueue;
            },

            // Upsell checks
            shouldShowUpsell: (trigger) => {
                const tier = get().tier;

                switch (trigger) {
                    case 'add_first_person':
                        return tier === 'free';
                    case 'add_person_limit':
                        // Only show if they've hit their limit
                        return tier !== 'cosmic' && SUBSCRIPTION_TIERS[tier].limits.maxPeople !== -1;
                    case 'deep_reading_limit':
                        return !get().canGenerateDeepReading();
                    case 'synastry_limit':
                        return !get().canGenerateSynastry();
                    case 'pdf_download':
                        return !get().canDownloadPDF();
                    case 'after_hook_sequence':
                        return tier === 'free';
                    case 'partner_deep_reading':
                        return tier === 'free' || tier === 'basic';
                    default:
                        return false;
                }
            },

            getUpsellForTrigger: (trigger) => {
                const show = get().shouldShowUpsell(trigger);
                const suggestedTier = (() => {
                    const current = get().tier;
                    switch (trigger) {
                        case 'add_first_person':
                        case 'after_hook_sequence':
                            return 'basic';
                        case 'deep_reading_limit':
                        case 'synastry_limit':
                        case 'pdf_download':
                        case 'partner_deep_reading':
                            return current === 'basic' ? 'pro' : 'basic';
                        case 'add_person_limit':
                            return 'cosmic';
                        default:
                            return 'basic';
                    }
                })();

                return { show, suggestedTier };
            },

            // Debug helper
            forceSetTier: (tier) => {
                set({
                    tier,
                    isActive: tier !== 'free',
                    expiresAt: tier !== 'free' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
                    productId: SUBSCRIPTION_TIERS[tier].appleProductId || null,
                });
                console.log(`🔧 DEV: Forced subscription tier to ${tier}`);
            },

            // Reset
            reset: () => {
                set(DEFAULT_SUBSCRIPTION_STATE);
            },
        }),
        {
            name: 'subscription-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Selectors
export const selectTier = (state: SubscriptionStore) => state.tier;
export const selectIsSubscribed = (state: SubscriptionStore) => state.tier !== 'free' && state.isActive;
export const selectCanAddPeople = (state: SubscriptionStore) => state.tier !== 'free';
