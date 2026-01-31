
import { Hono } from 'hono';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = new Hono();

/**
 * POST /api/auth/signup
 * 
 * Creates a new user account with email and password.
 * 
 * Request:
 * {
 *   "email": "user@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "user": { ... },
 *   "session": { access_token, refresh_token, ... }
 * }
 */
router.post('/signup', async (c) => {
    try {
        const body = await c.req.json();
        const { email: emailRaw, password, name } = body;
        const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : emailRaw;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return c.json({
                success: false,
                error: 'Invalid email address'
            }, 400);
        }

        if (!password || typeof password !== 'string' || password.length === 0) {
            return c.json({
                success: false,
                error: 'Password is required'
            }, 400);
        }

        console.log(`📧 Creating account for: ${email}${name ? ` (${name})` : ''}`);

        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('❌ Supabase not configured');
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Build user metadata with name if provided
        const userMetadata = name && typeof name === 'string' && name.trim()
            ? { full_name: name.trim() }
            : {};

        // ALWAYS auto-confirm email (no email confirmation required)
        console.log('✅ Auto-confirming email (no confirmation email required)');
        
        // Use admin API to create pre-confirmed user
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: userMetadata,
        });

        if (createError) {
            console.error('❌ Signup error:', createError.message);
            const msg = (createError.message || '').toLowerCase();
            if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
                return c.json({
                    success: false,
                    code: 'ACCOUNT_EXISTS',
                    error: 'Account already exists. Please sign in.',
                }, 409);
            }
            return c.json({
                success: false,
                error: createError.message
            }, 400);
        }

        // Auto sign-in after creating account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            console.error('❌ Auto sign-in error:', signInError.message);
            return c.json({
                success: false,
                error: 'Account created but sign-in failed: ' + signInError.message
            }, 400);
        }

        console.log('✅ Account created and auto-signed in');

        return c.json({
            success: true,
            user: signInData.user,
            session: signInData.session,
            clearLocalStorage: true, // Signal frontend to clear AsyncStorage for fresh start
        });

    } catch (error: any) {
        console.error('❌ Signup endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

/**
 * POST /api/auth/signin
 * 
 * Signs in an existing user with email and password.
 * 
 * Request:
 * {
 *   "email": "user@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "user": { ... },
 *   "session": { access_token, refresh_token, ... }
 * }
 */
router.post('/signin', async (c) => {
    try {
        const body = await c.req.json();
        const { email, password } = body;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return c.json({
                success: false,
                error: 'Invalid email address'
            }, 400);
        }

        if (!password || typeof password !== 'string') {
            return c.json({
                success: false,
                error: 'Password is required'
            }, 400);
        }

        console.log(`📧 Signing in: ${email}`);

        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('❌ Supabase not configured');
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('❌ Sign-in error:', error.message);
            return c.json({
                success: false,
                error: error.message
            }, 400);
        }

        console.log('✅ Sign-in successful');

        return c.json({
            success: true,
            user: data.user,
            session: data.session
        });

    } catch (error: any) {
        console.error('❌ Sign-in endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

/**
 * POST /api/auth/resend-confirmation
 * 
 * Resends the email confirmation link to the user.
 */
router.post('/resend-confirmation', async (c) => {
    try {
        const body = await c.req.json();
        const { email } = body;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return c.json({
                success: false,
                error: 'Invalid email address'
            }, 400);
        }

        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: `${env.FRONTEND_URL || 'oneinabillion://auth/confirm'}`,
            },
        });

        if (error) {
            console.error('❌ Resend confirmation error:', error.message);
            return c.json({
                success: false,
                error: error.message
            }, 400);
        }

        return c.json({
            success: true,
            message: 'Confirmation email sent. Please check your inbox.'
        });

    } catch (error: any) {
        console.error('❌ Resend confirmation endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

/**
 * POST /api/auth/forgot-password
 * 
 * Sends a password reset email to the user.
 */
router.post('/forgot-password', async (c) => {
    try {
        const body = await c.req.json();
        const { email } = body;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return c.json({
                success: false,
                error: 'Invalid email address'
            }, 400);
        }

        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_ANON_KEY!,
        );

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${env.FRONTEND_URL || 'oneinabillion://auth/reset-password'}`,
        });

        if (error) {
            console.error('❌ Password reset error:', error.message);
            // Don't reveal if email exists or not (security best practice)
            return c.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.'
            });
        }

        return c.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.'
        });

    } catch (error: any) {
        console.error('❌ Forgot password endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

/**
 * POST /api/auth/reset-password
 * 
 * Resets the user's password using a token from the email link.
 * Note: Supabase handles password reset via deep links automatically.
 * This endpoint is for manual token verification if needed.
 */
router.post('/reset-password', async (c) => {
    try {
        const body = await c.req.json();
        const { password, token_hash } = body;

        if (!password || typeof password !== 'string' || password.length === 0) {
            return c.json({
                success: false,
                error: 'Password is required'
            }, 400);
        }

        if (!token_hash || typeof token_hash !== 'string') {
            return c.json({
                success: false,
                error: 'Reset token is required'
            }, 400);
        }

        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_ANON_KEY!,
        );

        // Verify the token and update password
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token_hash,
            type: 'recovery',
        });

        if (error) {
            console.error('❌ Token verification error:', error.message);
            return c.json({
                success: false,
                error: 'Invalid or expired reset token'
            }, 400);
        }

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) {
            console.error('❌ Password update error:', updateError.message);
            return c.json({
                success: false,
                error: updateError.message
            }, 400);
        }

        return c.json({
            success: true,
            message: 'Password reset successfully. You can now sign in with your new password.'
        });

    } catch (error: any) {
        console.error('❌ Reset password endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

/**
 * POST /api/auth/verify-email
 * 
 * Verifies email confirmation token from the email link.
 */
router.post('/verify-email', async (c) => {
    try {
        const body = await c.req.json();
        const { token, type } = body;

        if (!token || typeof token !== 'string') {
            return c.json({
                success: false,
                error: 'Verification token is required'
            }, 400);
        }

        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
            return c.json({
                success: false,
                error: 'Server configuration error'
            }, 500);
        }

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_ANON_KEY!,
        );

        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type || 'signup',
        });

        if (error) {
            console.error('❌ Email verification error:', error.message);
            return c.json({
                success: false,
                error: error.message
            }, 400);
        }

        return c.json({
            success: true,
            message: 'Email verified successfully',
            user: data.user,
            session: data.session,
        });

    } catch (error: any) {
        console.error('❌ Verify email endpoint error:', error);
        return c.json({
            success: false,
            error: 'Internal server error'
        }, 500);
    }
});

export const authRouter = router;
