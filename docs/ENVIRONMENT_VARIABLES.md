# Environment Variables - Supabase Queue

## Required for Queue V2

Add these to your `.env` file or deployment environment:

```bash
# ═══════════════════════════════════════════════════════════════════════════
# SUPABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Project URL (from Supabase Dashboard → Settings → API)
SUPABASE_URL=https://your-project.supabase.co

# Service Role Key (SECRET! Never commit or expose to client)
# Used by workers to bypass RLS and claim tasks from any user's jobs
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>

# Anon Key (PUBLIC - safe to use in client-facing API)
# Used by API to respect RLS (users can only see their own jobs)
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>


# ═══════════════════════════════════════════════════════════════════════════
# FEATURE FLAGS
# ═══════════════════════════════════════════════════════════════════════════

# Enable Supabase Queue V2 (default: false)
# Set to 'true' to use Supabase, 'false' to use old JSON queue
SUPABASE_QUEUE_ENABLED=false

# Percentage of traffic to route to Queue V2 during gradual rollout (0-100)
# Only applies if SUPABASE_QUEUE_ENABLED=true
SUPABASE_QUEUE_ROLLOUT_PERCENT=10


# ═══════════════════════════════════════════════════════════════════════════
# WORKER CONFIGURATION (Fly.io)
# ═══════════════════════════════════════════════════════════════════════════

# Worker ID (auto-generated if not set: worker-{hostname}-{pid})
WORKER_ID=worker-fly-001

# Max concurrent tasks per worker (default: 5)
WORKER_MAX_CONCURRENT_TASKS=5

# Polling interval in milliseconds (default: 5000 = 5 seconds)
WORKER_POLLING_INTERVAL_MS=5000

# Max polling interval for exponential backoff (default: 30000 = 30 seconds)
WORKER_MAX_POLLING_INTERVAL_MS=30000


# ═══════════════════════════════════════════════════════════════════════════
# REPLICATE (for Audio/TTS Generation - Chatterbox Turbo)
# ═══════════════════════════════════════════════════════════════════════════

# Replicate API Token (from https://replicate.com/account/api-tokens)
REPLICATE_API_TOKEN=your-replicate-api-token

# Chunk delay in ms to avoid rate limits (default: 11000 for low-credit accounts)
# Can reduce to 3000-5000ms with $5+ account credit
REPLICATE_CHUNK_DELAY_MS=11000


# ═══════════════════════════════════════════════════════════════════════════
# MINIMAX (for Song/Music Generation - MiniMax Music 2.5)
# ═══════════════════════════════════════════════════════════════════════════

# MiniMax API Key (from https://www.minimax.chat/)
MINIMAX_API_KEY=your-minimax-api-key

# MiniMax Group ID (from your MiniMax dashboard)
MINIMAX_GROUP_ID=your-group-id


# ═══════════════════════════════════════════════════════════════════════════
# OPTIONAL: MONITORING & LOGGING
# ═══════════════════════════════════════════════════════════════════════════

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Sentry DSN for error tracking
SENTRY_DSN=https://...@sentry.io/...

# Datadog API key for metrics
DATADOG_API_KEY=...
```

## Where to Get These Values

### Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ KEEP SECRET!

### Database Connection String (for psql / migrations)

Some docs and command-line steps use a Postgres connection string (for `psql`) instead of the Supabase REST `SUPABASE_URL`.

- Use `DATABASE_URL` (or set `DATABASE_URL` in your shell) when running `psql` commands such as migrations or direct DB queries.
- You can find the Postgres connection string in Supabase Dashboard → Settings → Database → Connection string. It looks like `postgres://<user>:<password>@db.<project>.supabase.co:5432/postgres`.
- Do NOT expose this connection string publicly. Treat it as a secret and store it in GitHub Secrets or Fly.io secrets.

### Replicate Credentials (Audio/TTS)

1. Go to [Replicate Account](https://replicate.com/account/api-tokens)
2. Create or copy your **API Token** → `REPLICATE_API_TOKEN`
3. Note: Accounts with < $5 credit are rate-limited to 6 requests/minute

### MiniMax Credentials (Song/Music)

1. Go to [MiniMax Console](https://www.minimax.chat/)
2. Get your **API Key** → `MINIMAX_API_KEY`
3. Get your **Group ID** → `MINIMAX_GROUP_ID`

## Environment-Specific Configurations

### Development (Local)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_QUEUE_ENABLED=true
WORKER_MAX_CONCURRENT_TASKS=2
LOG_LEVEL=debug
```

### Production (Fly.io)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_QUEUE_ENABLED=true
WORKER_MAX_CONCURRENT_TASKS=5
REPLICATE_API_TOKEN=<REPLICATE_API_TOKEN>
MINIMAX_API_KEY=<MINIMAX_API_KEY>
MINIMAX_GROUP_ID=<MINIMAX_GROUP_ID>
LOG_LEVEL=info
SENTRY_DSN=<SENTRY_DSN>
```

## Security Best Practices

### ⚠️ NEVER commit secrets to Git

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### ✅ Use GitHub Secrets for CI/CD

In GitHub repo → Settings → Secrets → Actions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `REPLICATE_API_TOKEN`
- `MINIMAX_API_KEY`
- `MINIMAX_GROUP_ID`

### ✅ Use different keys per environment

- **Development:** Separate Supabase project
- **Staging:** Separate Supabase project
- **Production:** Separate Supabase project

### ✅ Rotate keys periodically

Go to Supabase Dashboard → Settings → API → Reset JWT Secret

## Validation Script

Run this to check if all required env vars are set:

```bash
npm run check-env
```

```typescript
// scripts/checkEnv.ts
const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'REPLICATE_API_TOKEN',
  'MINIMAX_API_KEY',
  'MINIMAX_GROUP_ID',
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required env var: ${varName}`);
    process.exit(1);
  } else {
    console.log(`✅ ${varName} is set`);
  }
}

console.log('\n✅ All required environment variables are set!');
```

## Migration Checklist

- [ ] Set `SUPABASE_URL`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set `SUPABASE_ANON_KEY`
- [ ] Set `REPLICATE_API_TOKEN`
- [ ] Set `MINIMAX_API_KEY`
- [ ] Set `MINIMAX_GROUP_ID`
- [ ] Set `SUPABASE_QUEUE_ENABLED=false` (start disabled)
- [ ] Test with `npm run check-env`
- [ ] Gradually enable with `SUPABASE_QUEUE_ROLLOUT_PERCENT=10`
- [ ] Scale to 100%
- [ ] Deploy workers to Fly.io
- [ ] Monitor logs and metrics


