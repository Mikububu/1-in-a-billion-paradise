# Supabase legacy API keys disabled

If you disabled **legacy** anon/service_role keys in Supabase (Settings → API Keys), use the **new** keys instead. Same env vars, new values.

## What to use

| Old (legacy, disabled) | New (use these) | Env var |
|------------------------|-----------------|---------|
| `anon` (JWT) | **Publishable key** `sb_publishable_...` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` (frontend) |
| `service_role` (JWT) | **Secret key** `sb_secret_...` | `SUPABASE_SERVICE_ROLE_KEY` (backend) |

## Where to get them

1. Supabase Dashboard → **Settings → API**
2. Open the **API Keys** tab (not **Legacy API Keys**).
3. Use **Publishable key** for client, **Secret key** for server. Create one if needed.

## What to set

**Frontend** (`.env` or EAS secrets):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # Publishable key
```

**Backend** (`.env` or Fly secrets):

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   # Secret key
```

No code changes. We still use `createClient(url, key)`; the new keys work as drop-in replacements.
