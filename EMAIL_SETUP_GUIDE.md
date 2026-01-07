# EMAIL SETUP GUIDE

## Overview
The authentication system requires email configuration in Supabase for:
- Email confirmation (signup)
- Password reset emails
- Email change notifications

## Required Setup

### 1. Supabase Email Configuration

Go to **Supabase Dashboard → Authentication → Email Templates**

#### Email Sender
- **From Email**: `noreply@oneinabillion.app` (or your domain)
- **From Name**: `1 In A Billion`

#### SMTP Configuration (Optional but Recommended)
If you want to use a custom SMTP server instead of Supabase's default:

**Settings → Auth → SMTP Settings**

```
SMTP Host: smtp.your-provider.com
SMTP Port: 587 (or 465 for SSL)
SMTP User: noreply@oneinabillion.app
SMTP Password: [your-smtp-password]
Sender Email: noreply@oneinabillion.app
Sender Name: 1 In A Billion
```

### 2. Email Templates

#### Signup Confirmation Email
**Template**: `Confirm signup`

Subject: `Confirm your email for 1 In A Billion`

Body:
```html
<h2>Welcome to 1 In A Billion</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
```

#### Password Reset Email
**Template**: `Reset password`

Subject: `Reset your password for 1 In A Billion`

Body:
```html
<h2>Password Reset Request</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
```

### 3. Redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `oneinabillion://auth`
- **Redirect URLs**:
  - `oneinabillion://auth/confirm` (email confirmation)
  - `oneinabillion://auth/reset-password` (password reset)
  - `oneinabillion://auth/callback` (OAuth callbacks)

### 4. Environment Variables

Add to `.env`:
```bash
FRONTEND_URL=oneinabillion://auth
```

This is used in the backend to set `emailRedirectTo` in auth requests.

## Current Implementation

### Backend (`src/routes/auth.ts`)
- ✅ Signup sends confirmation email (no auto-confirm)
- ✅ Password reset sends email via `/api/auth/forgot-password`
- ✅ Email confirmation resend via `/api/auth/resend-confirmation`
- ✅ Deep link handling for email confirmation and password reset

### Frontend (`src/screens/auth/SignInScreen.tsx`)
- ✅ Shows "Check Your Email" message after signup
- ✅ "Resend Email" button for confirmation
- ✅ "Forgot Password?" button and flow
- ✅ Deep link handling for email confirmation and password reset

## Testing

1. **Test Email Confirmation**:
   - Sign up with a new email
   - Check inbox for confirmation email
   - Click link → should confirm and sign in

2. **Test Password Reset**:
   - Click "Forgot Password?"
   - Enter email
   - Check inbox for reset email
   - Click link → should allow setting new password

## Domain Setup (if using custom domain)

If using `noreply@oneinabillion.app`:

1. **DNS Records** (add to your domain):
   - SPF: `v=spf1 include:supabase.co ~all`
   - DKIM: (provided by Supabase)
   - DMARC: `v=DMARC1; p=none;`

2. **Verify Domain** in Supabase Dashboard

## Notes

- Supabase provides default email sending (limited to 3 emails/hour on free tier)
- For production, use custom SMTP (SendGrid, Mailgun, AWS SES, etc.)
- Email templates can be customized in Supabase Dashboard
- All emails use the `FRONTEND_URL` for redirect links

