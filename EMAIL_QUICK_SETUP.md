# EMAIL QUICK SETUP GUIDE

## 🚀 Quick Start

Run the setup script to see all configuration instructions:

```bash
cd Paradise/1-in-a-billion-backend
npm run setup:email
```

## 📋 Manual Setup Checklist

### 1. Supabase Dashboard → Authentication → Email Templates

**Email Sender:**
- From Email: `noreply@oneinabillion.app`
- From Name: `1 In A Billion`

**Signup Confirmation Template:**
- Template: "Confirm signup"
- Subject: `Confirm your email for 1 In A Billion`
- Body: Use the HTML from `email-templates/signup-confirmation.html` (replace `{{ .ConfirmationURL }}` with the Supabase variable)

**Password Reset Template:**
- Template: "Reset password"
- Subject: `Reset your password for 1 In A Billion`
- Body: Use the HTML from `email-templates/password-reset.html` (replace `{{ .ConfirmationURL }}` with the Supabase variable)

### 2. Supabase Dashboard → Authentication → URL Configuration

**Site URL:**
```
oneinabillion://auth
```

**Redirect URLs (add all 3):**
```
oneinabillion://auth/confirm
oneinabillion://auth/reset-password
oneinabillion://auth/callback
```

### 3. Supabase Dashboard → Authentication → Settings

**Enable:**
- ✅ Enable email confirmations
- ✅ Enable signup via email

### 4. Environment Variable

Add to `.env`:
```bash
FRONTEND_URL=oneinabillion://auth
```

## 🎨 Email Templates

Pre-built HTML templates are in `Paradise/email-templates/`:
- `signup-confirmation.html` - Welcome email with confirmation link
- `password-reset.html` - Password reset email with security notice

Copy the HTML content into Supabase email templates, keeping the `{{ .ConfirmationURL }}` variable.

## 🔧 SMTP Setup (Production)

For production, configure custom SMTP in:
**Supabase Dashboard → Settings → Auth → SMTP Settings**

Recommended providers:
- **SendGrid**: `smtp.sendgrid.net:587`
- **Mailgun**: `smtp.mailgun.org:587`
- **AWS SES**: `email-smtp.region.amazonaws.com:587`

Configuration:
- SMTP Host: [your-provider]
- SMTP Port: 587
- SMTP User: `noreply@oneinabillion.app`
- SMTP Password: [your-smtp-password]
- Sender Email: `noreply@oneinabillion.app`
- Sender Name: `1 In A Billion`

## ✅ Testing

1. Sign up with a test email
2. Check inbox for confirmation email
3. Click link to confirm
4. Try "Forgot Password?" flow
5. Verify password reset email arrives

## 📝 Notes

- Supabase default email: Limited to 3 emails/hour (free tier)
- Custom SMTP: Required for production scale
- Email templates: Use HTML templates in `email-templates/` folder
- Deep links: Already configured in frontend `SignInScreen.tsx`

## 🔗 Related Files

- Backend auth routes: `1-in-a-billion-backend/src/routes/auth.ts`
- Frontend sign-in: `1-in-a-billion-frontend/src/screens/auth/SignInScreen.tsx`
- Setup script: `1-in-a-billion-backend/src/scripts/setupEmailConfig.ts`
- Full guide: `EMAIL_SETUP_GUIDE.md`

