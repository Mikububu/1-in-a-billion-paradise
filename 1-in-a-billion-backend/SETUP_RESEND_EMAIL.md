# Setup Resend Email Notifications

## Quick Setup (5 minutes)

### Step 1: Sign up for Resend (Free Tier)

1. Go to https://resend.com
2. Click "Sign Up" (you can use GitHub/Google)
3. **No credit card required** for the free tier (3,000 emails/month)

### Step 2: Get Your API Key

1. After signing up, go to **API Keys** in the dashboard
2. Click **"Create API Key"**
3. Name it: `1-in-a-billion-production`
4. Copy the API key (starts with `re_...`)
5. **Important:** Save it immediately - you can only see it once!

### Step 3: Add API Key to Supabase

1. Open Supabase Dashboard → SQL Editor
2. Run this SQL (replace `YOUR_RESEND_API_KEY` with your actual key):

```sql
-- Add Resend API key to api_keys table
INSERT INTO api_keys (service, token, created_at, updated_at)
VALUES ('resend', 'YOUR_RESEND_API_KEY', NOW(), NOW())
ON CONFLICT (service) 
DO UPDATE SET token = EXCLUDED.token, updated_at = NOW();
```

**OR** use the helper script:

```bash
cd 1-in-a-billion-backend
npx tsx -e "
import { createSupabaseServiceClient } from './src/services/supabaseClient';
const supabase = createSupabaseServiceClient();
const { error } = await supabase.from('api_keys').upsert({
  service: 'resend',
  token: 'YOUR_RESEND_API_KEY', // Replace with your actual key
  updated_at: new Date().toISOString()
}, { onConflict: 'service' });
console.log(error ? 'Error:' + error.message : '✅ Resend API key saved!');
"
```

### Step 4: Verify Domain (Optional but Recommended)

For production, you should verify your domain:

1. In Resend Dashboard → **Domains**
2. Click **"Add Domain"**
3. Enter: `oneinabillion.app`
4. Add the DNS records Resend provides:
   - SPF record
   - DKIM record
   - DMARC record (optional)

**Note:** You can start sending emails immediately without domain verification, but they'll come from `onboarding@resend.dev` (which is fine for testing).

### Step 5: Test It

The system will automatically use Resend when:
- A job completes
- A user subscribes to notifications

To test manually, you can trigger a job completion and check:
1. Backend logs for: `✅ Email sent to [email] (Resend ID: ...)`
2. User's inbox for the notification email

## Email Content

**Subject:** `🎉 Your Reading is Ready!`

**Body:**
```
[PersonName]'s [SystemName] reading is complete and waiting for you.
```

**HTML:**
```html
<h2>🎉 Your Reading is Ready!</h2>
<p>[PersonName]'s [SystemName] reading is complete and waiting for you.</p>
<p><a href="1inabillion://job/[jobId]">Open in App</a></p>
```

## Troubleshooting

### "Resend API key not found"
- Check that the key is in Supabase `api_keys` table with `service = 'resend'`
- Verify the key starts with `re_`

### "Email not sending"
- Check Resend dashboard → **Logs** for error messages
- Verify your email address is valid
- Check backend logs for Resend error details

### "Domain not verified"
- This is OK for testing - emails will come from `onboarding@resend.dev`
- For production, verify your domain in Resend dashboard

## Free Tier Limits

- **3,000 emails/month** (free forever)
- If you exceed, you'll need to upgrade to Pro ($20/month for 50,000 emails)

## Cost Estimate

For a typical app:
- 100 users/month × 1 reading each = 100 emails/month
- **Well within the free tier!**

Even with 1,000 users/month, you'd only use ~1,000 emails/month, still free.

## Next Steps

Once set up, emails will automatically send when:
1. ✅ Jobs complete
2. ✅ Users have subscribed to notifications
3. ✅ User email is found in `library_people` table

No code changes needed - just add the API key!
