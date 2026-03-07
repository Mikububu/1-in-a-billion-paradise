import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { navigationRef } from '@/navigation/navigationRef';

export const useSupabaseAuthBootstrap = () => {
    const setUser = useAuthStore((s) => s.setUser);
    const setSession = useAuthStore((s) => s.setSession);
    const setIsAuthReady = useAuthStore((s) => s.setIsAuthReady);

    useEffect(() => {
        console.log('🔒 SupabaseAuthBootstrap: Starting...');
        let isInitialSessionHandled = false;

        // Listen for changes FIRST to avoid race condition with getSession
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔒 Auth state change:', event);
            // Skip INITIAL_SESSION if we already handled the initial session via getSession
            if (event === 'INITIAL_SESSION' && isInitialSessionHandled) return;

            setSession(session);
            setUser(session?.user || null);
            if (!isInitialSessionHandled) {
                setIsAuthReady(true);
                isInitialSessionHandled = true;
            }

            // When user clicks password reset link, navigate to ResetPassword screen
            if (event === 'PASSWORD_RECOVERY') {
                console.log('🔑 Password recovery detected, navigating to ResetPassword');
                setTimeout(() => {
                    try {
                        (navigationRef.current as any)?.navigate('Onboarding' as any, {
                            screen: 'ResetPassword',
                        });
                    } catch (e) {
                        console.error('🔑 Could not navigate to ResetPassword:', e);
                    }
                }, 300);
            }
        });

        // Then check initial session
        (async () => {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    if (/Invalid Refresh Token/i.test(error.message || '')) {
                        await supabase.auth.signOut({ scope: 'local' });
                    }
                    throw error;
                }

                if (!isInitialSessionHandled) {
                    const session = data.session;
                    setSession(session);
                    setUser(session?.user || null);
                    setIsAuthReady(true);
                    isInitialSessionHandled = true;

                    // Sync server-side free overlay flag (survives reinstalls)
                    if (session?.user?.id) {
                        useAuthStore.getState().syncFreeOverlayFromServer(session.user.id);
                    }
                }
                console.log('🔒 SupabaseAuthBootstrap: Complete', !!data.session);
            } catch (error) {
                console.error('🔒 SupabaseAuthBootstrap: getSession failed', error);
                if (!isInitialSessionHandled) {
                    setSession(null);
                    setUser(null);
                    setIsAuthReady(true);
                    isInitialSessionHandled = true;
                }
            }
        })();

        return () => subscription.unsubscribe();
    }, []);
};
