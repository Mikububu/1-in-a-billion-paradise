/**
 * AUTH STORE
 * 
 * Manages user authentication state.
 * Persists Dev users fully, real Supabase users only persist displayName.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Session } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthReady: boolean; // NEW: true when session hydration complete
  displayName: string | null;
  // Context to distinguish Direct Login vs Onboarding Sign Up
  flowType: 'direct_login' | 'onboarding' | null;
  // Compatibility preview entitlement (client-side guard; not bulletproof vs reinstall)
  freeOverlayUsedByUserId: Record<string, boolean>;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setDisplayName: (name: string) => void;
  setFlowType: (type: 'direct_login' | 'onboarding' | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsAuthReady: (ready: boolean) => void; // NEW
  signOut: () => Promise<void>;
  hasUsedFreeOverlay: (userId?: string | null) => boolean;
  markFreeOverlayUsed: (userId?: string | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthReady: false, // NEW: starts false, set to true after bootstrap
      displayName: null,
      flowType: null,
      freeOverlayUsedByUserId: {},

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setDisplayName: (displayName) => set({ displayName }),
      setFlowType: (flowType) => set({ flowType }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setIsAuthReady: (isAuthReady) => set({ isAuthReady }), // NEW

      signOut: async () => {
        // CONTRACT: Clear Supabase session FIRST before local state
        try {
          const { supabase } = await import('@/services/supabase');
          await supabase.auth.signOut();
          console.log('✅ Supabase session cleared');

          // CRITICAL: Clear Supabase's AsyncStorage keys to prevent session rehydration
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const keys = await AsyncStorage.getAllKeys();
          const supabaseKeys = keys.filter(key =>
            key.startsWith('sb-') ||
            key.includes('supabase') ||
            key.includes('auth-token')
          );

          if (supabaseKeys.length > 0) {
            await AsyncStorage.multiRemove(supabaseKeys);
            console.log('✅ Cleared Supabase AsyncStorage keys:', supabaseKeys);
          }
        } catch (err) {
          console.error('❌ Supabase signOut error:', err);
        }

        // Then clear local state
        // NavigationContainer will automatically switch to OnboardingNavigator when user becomes null
        set({
          user: null,
          session: null,
          displayName: null,
          flowType: null,
        });
      },

      hasUsedFreeOverlay: (userId) => {
        const key = userId || 'anonymous';
        const state = get();
        return Boolean(state.freeOverlayUsedByUserId?.[key]);
      },

      markFreeOverlayUsed: (userId) => {
        const key = userId || 'anonymous';
        set((state) => ({
          freeOverlayUsedByUserId: {
            ...(state.freeOverlayUsedByUserId || {}),
            [key]: true,
          },
        }));
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1, // Bump version to force clear old state
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from version 0 (or no version) to 1:
          // Discard old state completely to remove stale 'user' object
          return {
            user: null,
            session: null,
            isLoading: true,
            displayName: null,
            flowType: null,
            freeOverlayUsedByUserId: {},
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        displayName: state.displayName,
        freeOverlayUsedByUserId: state.freeOverlayUsedByUserId,
        // user: state.user, // Do not persist user manually. Rely on Bootstrap + Supabase Session.
      }),
    }
  )
);




