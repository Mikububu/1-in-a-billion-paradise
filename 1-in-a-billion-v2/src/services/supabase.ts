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

// Create Supabase client
export const supabase = createClient(
    env.SUPABASE_URL || 'https://placeholder.supabase.co',
    env.SUPABASE_ANON_KEY || 'placeholder',
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
            redirectTo: 'oneinabillionv2://auth/callback',
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
