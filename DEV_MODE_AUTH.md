# DEV MODE AUTHENTICATION

## Overview

The authentication system supports two modes:

1. **PRODUCTION MODE** (default): Requires email confirmation
2. **DEV MODE**: Auto-confirms emails for testing (bypasses email confirmation)

## Current Status

**Right now, the system is in PRODUCTION MODE** - it requires email confirmation.

However, **if Supabase Dashboard has "Enable email confirmations" turned OFF**, users will be auto-confirmed even in production mode.

## Enable DEV Mode (Auto-Confirm)

To bypass email confirmation for testing, add to your `.env`:

```bash
DEV_AUTO_CONFIRM_EMAIL=true
```

### What DEV Mode Does:

- ✅ Creates user account immediately
- ✅ Auto-confirms email (no email sent)
- ✅ Auto-signs in user
- ✅ Returns session tokens immediately

### What DEV Mode Does NOT Do:

- ❌ Send confirmation emails
- ❌ Require email verification
- ❌ Wait for user to click email link

## Production Setup

For production, **DO NOT** set `DEV_AUTO_CONFIRM_EMAIL=true`.

Instead, configure Supabase Dashboard:

1. **Enable Email Confirmations**:
   - Go to: Supabase Dashboard → Authentication → Settings
   - Enable: "Enable email confirmations"
   - Enable: "Enable signup via email"

2. **Configure Email Templates**:
   - Go to: Authentication → Email Templates
   - Set sender: `noreply@oneinabillion.app`
   - Customize templates (see `EMAIL_SETUP_GUIDE.md`)

3. **Set Redirect URLs**:
   - Go to: Authentication → URL Configuration
   - Add: `oneinabillion://auth/confirm`
   - Add: `oneinabillion://auth/reset-password`

## Testing

### Test DEV Mode:
```bash
# Add to .env
DEV_AUTO_CONFIRM_EMAIL=true

# Restart backend
npm run dev

# Sign up - should auto-confirm and sign in immediately
```

### Test Production Mode:
```bash
# Remove or set to false in .env
DEV_AUTO_CONFIRM_EMAIL=false

# Restart backend
npm run dev

# Sign up - should require email confirmation
# Check inbox for confirmation email
```

## Code Behavior

### DEV Mode (`DEV_AUTO_CONFIRM_EMAIL=true`):
```typescript
// Uses admin API to create pre-confirmed user
supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // Auto-confirm
});

// Then auto-signs in
supabase.auth.signInWithPassword({ email, password });
```

### Production Mode (default):
```typescript
// Uses regular signup (requires email confirmation)
supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'oneinabillion://auth/confirm',
  },
});

// Returns requiresConfirmation: true
// User must click email link to confirm
```

## Security Warning

⚠️ **NEVER** set `DEV_AUTO_CONFIRM_EMAIL=true` in production!

This bypasses email verification and allows anyone to create accounts without verifying their email address.

## Current Recommendation

**For testing right now**, you have two options:

1. **Use DEV Mode** (easiest):
   ```bash
   # Add to .env
   DEV_AUTO_CONFIRM_EMAIL=true
   ```

2. **Configure Supabase Dashboard** (proper setup):
   - Enable email confirmations
   - Set up email templates
   - Use real email addresses for testing

The code is ready for both modes - just choose which one you want to use!

