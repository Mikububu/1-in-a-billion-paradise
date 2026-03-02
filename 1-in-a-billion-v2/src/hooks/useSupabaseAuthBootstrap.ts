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

        // Check initial session
        (async () => {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    if (/Invalid Refresh Token/i.test(error.message || '')) {
                        await supabase.auth.signOut({ scope: 'local' });
                    }
                    throw error;
                }

                const session = data.session;
                setSession(session);
                setUser(session?.user || null);
                setIsAuthReady(true);
                console.log('🔒 SupabaseAuthBootstrap: Complete', !!session);
            } catch (error) {
                console.error('🔒 SupabaseAuthBootstrap: getSession failed', error);
                setSession(null);
                setUser(null);
                setIsAuthReady(true);
            }
        })();

        // Listen for changes — including PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔒 Auth state change:', event);
            setSession(session);
            setUser(session?.user || null);

            // When user clicks password reset link, navigate to ResetPassword screen
            if (event === 'PASSWORD_RECOVERY') {
                console.log('🔑 Password recovery detected, navigating to ResetPassword');
                // Small delay to allow navigation to be ready
                setTimeout(() => {
                    try {
                        navigationRef.current?.navigate('Onboarding' as any, {
                            screen: 'ResetPassword',
                        });
                    } catch (e) {
                        console.error('🔑 Could not navigate to ResetPassword:', e);
                    }
                }, 300);
            }
        });

        return () => subscription.unsubscribe();
    }, []);
};
