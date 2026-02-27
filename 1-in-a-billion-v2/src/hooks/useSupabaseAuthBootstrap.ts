import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';

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

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);
};
