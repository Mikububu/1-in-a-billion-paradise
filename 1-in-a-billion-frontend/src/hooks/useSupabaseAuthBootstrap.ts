import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { upsertSelfProfileToSupabase, initializeCommercialState } from '@/services/profileUpsert';

/**
 * Clears all Supabase auth-related keys from AsyncStorage.
 * Used when refresh tokens are invalid/corrupted.
 */
async function clearSupabaseTokens() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(key =>
      key.startsWith('sb-') ||
      key.includes('supabase') ||
      key.includes('auth-token')
    );

    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
      console.log('🧹 Cleared corrupted Supabase tokens:', supabaseKeys.length);
    }
  } catch (err) {
    console.warn('⚠️ Failed to clear Supabase tokens:', err);
  }
}

/**
 * Bootstraps authStore from Supabase persisted session.
 * 
 * ROUTING INVARIANT (DO NOT MODIFY):
 * - If session exists → Set auth state → RootNavigator renders Dashboard
 * - If no session → Clear auth state → RootNavigator renders Intro
 * 
 * NO profile checks. NO onboarding state checks. NO blocking.
 * Profile creation/updates happen asynchronously in the background.
 * 
 * This invariant prevents infinite loops and ensures predictable navigation.
 */
export function useSupabaseAuthBootstrap() {
  const setUser = useAuthStore((s: any) => s.setUser);
  const setSession = useAuthStore((s: any) => s.setSession);
  const setDisplayName = useAuthStore((s: any) => s.setDisplayName);
  const setIsLoading = useAuthStore((s: any) => s.setIsLoading);
  const setIsAuthReady = useAuthStore((s: any) => s.setIsAuthReady);

  useEffect(() => {
    let mounted = true;

    console.log('🚀 useSupabaseAuthBootstrap: Hook mounted, isSupabaseConfigured:', isSupabaseConfigured);

    const run = async () => {
      try {
        if (!isSupabaseConfigured) {
          console.log('⚠️ Bootstrap: Supabase NOT configured - exiting early');
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        // Get session - NO PROFILE CHECKS
        console.log('🔄 Bootstrap: Getting session...');

        let session = null;
        try {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.warn('⚠️ Bootstrap: getSession error:', error.message);
            // Check if it's a refresh token error
            if (error.message?.toLowerCase().includes('refresh token')) {
              console.log('🧹 Bootstrap: Invalid refresh token detected - clearing tokens');
              await clearSupabaseTokens();
              await supabase.auth.signOut();
            }

            if (!mounted) return;
            setSession(null);
            setUser(null);
            setDisplayName('');
            setIsLoading(false);
            setIsAuthReady(true);
            return;
          }

          session = data?.session || null;
        } catch (err: any) {
          console.error('❌ Bootstrap: Fatal getSession error:', err);
          await clearSupabaseTokens();

          if (!mounted) return;
          setSession(null);
          setUser(null);
          setDisplayName('');
          setIsLoading(false);
          setIsAuthReady(true);
          return;
        }

        if (!mounted) return;

        if (session) {
          console.log('✅ Bootstrap: Session exists, setting auth state');

          // #region agent log
          // H12: Bootstrap sees a session and will attempt to set authStore
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuthBootstrap.ts:104',message:'Bootstrap session exists',data:{hasUser:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'BOOT1'})}).catch(()=>{});
          // #endregion

          // CRITICAL: Check if user actually exists in database
          // This handles orphaned sessions for deleted users
          try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
              console.log('⚠️ Bootstrap: Session exists but user deleted - forcing sign out');
              await clearSupabaseTokens();
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
              setDisplayName('');
              setIsLoading(false);
              setIsAuthReady(true);
              return;
            }
          } catch (e) {
            console.log('⚠️ Bootstrap: Error checking user - forcing sign out');
            await clearSupabaseTokens();
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setDisplayName('');
            setIsLoading(false);
            setIsAuthReady(true);
            return;
          }

          setSession(session);
          setUser(session.user);
          // #region agent log
          // H13: Auth store setUser executed
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuthBootstrap.ts:133',message:'Auth store updated from Supabase session',data:{userId:session.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'BOOT2'})}).catch(()=>{});
          // #endregion
          const name =
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')?.[0] ||
            'User';
          setDisplayName(name);

          // CRITICAL FIX: Check Supabase for existing profile to determine if onboarding is complete
          // This establishes Supabase as the single source of truth
          try {
            console.log('🔍 Bootstrap: Checking for profile in library_people for user:', session.user.id);
            const { data: profiles, error: profileError } = await supabase
              .from('library_people')
              .select('user_id, name, birth_data, hook_readings')
              .eq('user_id', session.user.id)
              .eq('is_user', true)
              .limit(1);

            if (profileError) {
              console.error('❌ Bootstrap: Profile query error:', profileError);
            } else {
              console.log('📊 Bootstrap: Profile query result:', profiles?.length || 0, 'profiles found');
              if (profiles && profiles.length > 0) {
                console.log('📊 Bootstrap: Profile data:', JSON.stringify(profiles[0], null, 2));
              }
            }

            if (!profileError && profiles && profiles.length > 0) {
              const { useOnboardingStore } = await import('@/store/onboardingStore');
              const profile = profiles[0];
              
              // Only mark onboarding complete if user has hook readings
              // Having a profile doesn't mean onboarding is complete - user might have just created account
              // hook_readings can be either an object {sun, moon, rising} or an array
              const hasHookReadings = profile.hook_readings && (
                (typeof profile.hook_readings === 'object' && Object.keys(profile.hook_readings).length > 0) ||
                (Array.isArray(profile.hook_readings) && profile.hook_readings.length > 0)
              );
              if (hasHookReadings) {
                console.log('✅ Bootstrap: User has profile AND hook readings - marking onboarding complete');
                
                // #region agent log
                // Check INVARIANT 3: Bootstrap Flag Setting
                if (__DEV__) {
                  import('@/utils/architectureDebugger').then(({ checkInvariant3_BootstrapFlag, instrumentStateChange }) => {
                    const oldValue = useOnboardingStore.getState().hasCompletedOnboarding;
                    useOnboardingStore.getState().setHasCompletedOnboarding(true);
                    
                    // Check invariant
                    const check = checkInvariant3_BootstrapFlag();
                    if (!check.passed && check.violation) {
                      console.warn('⚠️ INVARIANT 3 CHECK:', check.violation);
                    }
                    
                    // Instrument state change
                    instrumentStateChange('onboarding', {
                      key: 'hasCompletedOnboarding',
                      oldValue,
                      newValue: true,
                      reason: 'Bootstrap: User has hook readings in Supabase',
                    });
                  }).catch(() => {
                    // Fallback if import fails
                    useOnboardingStore.getState().setHasCompletedOnboarding(true);
                  });
                } else {
                  useOnboardingStore.getState().setHasCompletedOnboarding(true);
                }
                // #endregion
                
                // Hydrate hook readings
                profile.hook_readings.forEach((reading: any) => {
                  if (reading && reading.type) {
                    useOnboardingStore.getState().setHookReading(reading);
                  }
                });
              } else {
                console.log('🔄 Bootstrap: User has profile but no hook readings - onboarding incomplete');
                
                // #region agent log
                // Instrument state change
                if (__DEV__) {
                  import('@/utils/architectureDebugger').then(({ instrumentStateChange }) => {
                    const oldValue = useOnboardingStore.getState().hasCompletedOnboarding;
                    useOnboardingStore.getState().setHasCompletedOnboarding(false);
                    
                    instrumentStateChange('onboarding', {
                      key: 'hasCompletedOnboarding',
                      oldValue,
                      newValue: false,
                      reason: 'Bootstrap: User has profile but no hook readings',
                    });
                  }).catch(() => {
                    useOnboardingStore.getState().setHasCompletedOnboarding(false);
                  });
                } else {
                  useOnboardingStore.getState().setHasCompletedOnboarding(false);
                }
                // #endregion
              }
            } else {
              console.log('🔄 Bootstrap: No profile found - user needs to complete onboarding');
            }
          } catch (profileCheckError) {
            console.warn('Profile check failed (non-blocking):', profileCheckError);
          }

          // Upsert self profile to Supabase (non-blocking)
          const { upsertSelfProfileToSupabase, initializeCommercialState } = await import('@/services/profileUpsert');
          upsertSelfProfileToSupabase({
            userId: session.user.id,
            email: session.user.email || '',
            displayName: name,
          }).catch((err) => {
            console.warn('Profile upsert failed (non-blocking):', err);
          });

          // Initialize commercial state (free tier)
          initializeCommercialState(session.user.id).catch((err) => {
            console.warn('Commercial state init failed (non-blocking):', err);
          });
        } else {
          console.log('🔄 Bootstrap: No session, clearing auth state');
          setSession(null);
          setUser(null);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('❌ Bootstrap Error:', err);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          // Still mark as ready even on error to prevent infinite loading
          setIsAuthReady(true);
        }
      } finally {
        if (mounted) {
          console.log('🚀 BOOTSTRAP COMPLETE - Setting isAuthReady: true');
          setIsAuthReady(true);
        }
      }
    };

    run();

    if (!isSupabaseConfigured) return () => { };

    // 3. Listen for auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('🔄 Auth State Change:', event, 'Session:', !!session);
      console.log('📊 DEBUG: Auth listener triggered, mounted:', mounted);

      if (!session) {
        console.log('🔌 Auth Listener: No session, clearing auth state');
        setSession(null);
        setUser(null);
        setDisplayName('');
        return;
      }

      console.log('📊 DEBUG: Session exists, user ID:', session.user.id);

      // CRITICAL: Check if user actually exists in database (handles orphaned sessions)
      try {
        console.log('🔍 Auth Listener: Checking if user exists...');
        const { data: { user }, error } = await Promise.race([
          supabase.auth.getUser(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]) as any;

        if (error || !user) {
          console.log('⚠️ Auth Listener: Session exists but user deleted - forcing sign out');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setDisplayName('');
          return;
        }
        console.log('✅ Auth Listener: User exists in database');
      } catch (e) {
        console.log('⚠️ Auth Listener: Error/timeout checking user - proceeding anyway', e);
        // Don't block auth flow on timeout - just proceed
      }

      console.log('📊 DEBUG: Getting flowType from authStore...');
      const flowType = useAuthStore.getState().flowType;
      console.log('📊 DEBUG: flowType =', flowType);

      if (flowType === 'onboarding') {
        console.log('✅ Auth Listener: Onboarding flow - skipping profile check');
        console.log('📊 DEBUG: Setting session and user...');
        setSession(session);
        setUser(session.user);
        const name =
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')?.[0] ||
          'User';
        console.log('📊 DEBUG: Display name will be:', name);
        setDisplayName(name);
        console.log('✅ DEBUG: Auth state set for onboarding flow');
        return;
      }

      // For non-onboarding flows, set auth state
      console.log('✅ Auth Listener: Profile exists, setting auth state');
      setSession(session);
      setUser(session.user);
      const name =
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')?.[0] ||
        'User';
      setDisplayName(name);

      // Upsert self profile to Supabase (non-blocking)
      upsertSelfProfileToSupabase({
        userId: session.user.id,
        email: session.user.email || '',
        displayName: name,
      }).catch((err) => {
        console.warn('Profile upsert failed (non-blocking):', err);
      });

      // Initialize commercial state (free tier)
      initializeCommercialState(session.user.id).catch((err) => {
        console.warn('Commercial state init failed (non-blocking):', err);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps - Zustand setters are stable, and we only want this to run once on mount
};




