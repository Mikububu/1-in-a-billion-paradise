# RevenueCat Backend (Test V2)

Backend uses RevenueCat **only for webhooks** to sync subscription state into `user_subscriptions`. The app uses the RevenueCat SDK for purchases; no payment routes are called from the client.

## Env

In `.env` or Supabase `api_keys` (service `revenuecat_secret`):

```bash
# RevenueCat secret – same value you set in RevenueCat Dashboard → Webhooks → Authorization header
REVENUECAT_SECRET_KEY=your_secret_here
```

- Use your **test** secret key for Test V2 (e.g. from RevenueCat Dashboard → Project → API Keys).
- In RevenueCat Dashboard → Webhooks, set the Authorization header to `Bearer <REVENUECAT_SECRET_KEY>` (or the raw token; the backend accepts `Authorization: Bearer <token>` and compares the token to `REVENUECAT_SECRET_KEY`).

## Webhook URL

Point RevenueCat to:

```
https://your-fly-app.fly.dev/api/payments/webhook
```

After deploy, set this in RevenueCat Dashboard → Project → Webhooks.

## Flow

1. User purchases in the app via RevenueCat (Apple/Google).
2. RevenueCat sends a webhook to `POST /api/payments/webhook` with `Authorization: Bearer <secret>`.
3. Backend verifies the token, parses the event, and upserts `user_subscriptions` (RevenueCat rows use `stripe_subscription_id = 'rc_' + transaction_id`).
4. Entitlement checks use `subscriptionService.checkUserSubscription(userId)` as before.

No secret values are committed; keep keys in `.env` or Supabase only.
