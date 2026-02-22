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
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user || null);
            setIsAuthReady(true);
            console.log('🔒 SupabaseAuthBootstrap: Complete', !!session);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);
};
