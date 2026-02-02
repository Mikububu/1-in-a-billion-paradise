import { useEffect } from 'react';
import { Linking } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

export function useSupabaseDeepLink() {
    const setSession = useAuthStore((s: any) => s.setSession);
    const setUser = useAuthStore((s: any) => s.setUser);

    useEffect(() => {
        // 1. Handle deep link if app was cold-launched by the URL
        const handleInitialUrl = async () => {
            try {
                const initialUrl = await Linking.getInitialURL();
                if (initialUrl && initialUrl.includes('auth/callback')) {
                    console.log('🔗 Deep Link (Initial):', initialUrl);
                    handleAuthUrl(initialUrl);
                }
            } catch (e) {
                console.error('Deep link error:', e);
            }
        };
        handleInitialUrl();

        const handleUrl = (event: any) => {
            const url = event?.url || event;
            if (url && url.includes('auth/callback')) {
                console.log('🔗 Global Listener caught URL:', url);
                handleAuthUrl(url);
            }
        };

        const subscription = Linking.addEventListener('url', handleUrl);

        return () => {
            subscription.remove();
        };
    }, []);

    const handleAuthUrl = async (url: string) => {
        try {
            console.log('🔗 Handling Auth URL:', url);
            // DEBUG: Log deep link call
            // alert(`Deep Link Received:\n${url.substring(0, 100)}...`);

            // 1. Try parsing hash (Implicit Flow) - #access_token=...
            const [baseUrl, fragment] = url.split('#');
            if (fragment) {
                const params = new URLSearchParams(fragment);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    console.log('✅ Found tokens in Hash, setting session...');
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });
                    if (error) console.error('Failed to set session from hash:', error);
                    else console.log('🚀 Session set successfully via Hash!');
                    return;
                }
            }

            // 2. Try parsing query params (PKCE Flow) - ?code=...
            // Note: This requires standard query param parsing
            const queryPart = url.split('?')[1];
            if (queryPart) {
                const params = new URLSearchParams(queryPart);
                const code = params.get('code');
                const errorDescription = params.get('error_description');

                if (errorDescription) {
                    console.error('❌ Auth Error in URL:', errorDescription);
                    return;
                }

                if (code) {
                    console.log('✅ Found PKCE Code in URL, exchanging for session...');
                    // supabase.auth.exchangeCodeForSession(code) isn't directly exposed in all client versions
                    // differently. But typically the automatic flow handles it if we let it.
                    // However, since we are manual:
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) console.error('Failed to exchange code:', error);
                    else console.log('🚀 Session set successfully via PKCE Code exchange!');
                    return;
                }
            }

            console.warn('⚠️ No tokens or code found in deep link.');

        } catch (err) {
            console.error('Error parsing auth URL:', err);
        }
    };
}

