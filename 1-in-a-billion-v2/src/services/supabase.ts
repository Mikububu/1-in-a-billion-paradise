/**
 * SUPABASE CLIENT
 *
 * Handles authentication and database operations.
 */

import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { env } from '@/config/env'

// Check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(
    env.SUPABASE_URL && env.SUPABASE_ANON_KEY
)

// Fail fast if Supabase is not configured
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
        'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
}

// Create Supabase client
export const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
)

// Auth helpers
export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'oneinabillion://auth/callback',
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    })
    return { data, error }
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
}

export const getCurrentUser = async () => {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()
    return { user, error }
}

export const getCurrentSession = async () => {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession()
    return { session, error }
}
