"use strict";
/**
 * SUPABASE CLIENT - Service Role Access
 *
 * This client uses the SERVICE_ROLE_KEY to bypass RLS.
 * Workers use this to claim tasks from any user's jobs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseUser = exports.supabase = void 0;
exports.createSupabaseServiceClient = createSupabaseServiceClient;
exports.createSupabaseUserClientFromAccessToken = createSupabaseUserClientFromAccessToken;
exports.getSignedArtifactUrl = getSignedArtifactUrl;
exports.uploadArtifact = uploadArtifact;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
// Validate environment variables
if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase credentials missing. Queue V2 disabled.');
}
// Create client (service role for workers)
exports.supabase = env_1.env.SUPABASE_URL && env_1.env.SUPABASE_SERVICE_ROLE_KEY
    ? (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;
// Convenience: create or return the service-role Supabase client
function createSupabaseServiceClient() {
    return exports.supabase;
}
// Create client for user-facing API (respects RLS)
exports.supabaseUser = env_1.env.SUPABASE_URL && env_1.env.SUPABASE_ANON_KEY
    ? (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_ANON_KEY)
    : null;
/**
 * Create a user-scoped Supabase client from a Supabase access token.
 * This respects RLS because it uses the anon key + Authorization header.
 */
function createSupabaseUserClientFromAccessToken(accessToken) {
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_ANON_KEY)
        return null;
    if (!accessToken)
        return null;
    return (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
/**
 * Helper: Get signed URL for artifact (1 hour expiry)
 */
async function getSignedArtifactUrl(storagePath, expiresIn = 3600) {
    if (!exports.supabase)
        return null;
    const { data, error } = await exports.supabase.storage
        .from('job-artifacts')
        .createSignedUrl(storagePath, expiresIn);
    if (error) {
        console.error('Failed to create signed URL:', error);
        return null;
    }
    return data.signedUrl;
}
/**
 * Helper: Upload artifact to Storage
 */
async function uploadArtifact(storagePath, buffer, contentType) {
    if (!exports.supabase)
        return null;
    const { data, error } = await exports.supabase.storage
        .from('job-artifacts')
        .upload(storagePath, buffer, {
        contentType,
        upsert: true, // Idempotent
    });
    if (error) {
        console.error('Failed to upload artifact:', error);
        return null;
    }
    return data.path;
}
//# sourceMappingURL=supabaseClient.js.map