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
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Anon Key (PUBLIC - safe to use in client-facing API)
# Used by API to respect RLS (users can only see their own jobs)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...


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
# WORKER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Worker ID (auto-generated if not set: worker-{hostname}-{pid})
WORKER_ID=worker-runpod-001

# Max concurrent tasks per worker (default: 5)
WORKER_MAX_CONCURRENT_TASKS=5

# Polling interval in milliseconds (default: 5000 = 5 seconds)
WORKER_POLLING_INTERVAL_MS=5000

# Max polling interval for exponential backoff (default: 30000 = 30 seconds)
WORKER_MAX_POLLING_INTERVAL_MS=30000


# ═══════════════════════════════════════════════════════════════════════════
# RUNPOD TTS (for Audio Workers)
# ═══════════════════════════════════════════════════════════════════════════

# RunPod API Key (from https://www.runpod.io/console/user/settings)
RUNPOD_API_KEY=your-runpod-api-key

# RunPod Endpoint ID (from Serverless → Endpoints)
RUNPOD_ENDPOINT_ID=your-endpoint-id

# Voice sample URL for Chatterbox TTS
VOICE_SAMPLE_URL=https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_sample.mp3


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

### RunPod Credentials

1. Go to [RunPod Console](https://www.runpod.io/console)
2. Go to **User Settings**
3. Copy **API Key** → `RUNPOD_API_KEY`
4. Go to **Serverless → Endpoints**
5. Copy your endpoint ID → `RUNPOD_ENDPOINT_ID`

## Environment-Specific Configurations

### Development (Local)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_QUEUE_ENABLED=true
WORKER_MAX_CONCURRENT_TASKS=2
LOG_LEVEL=debug
```

### Production (RunPod)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_QUEUE_ENABLED=true
WORKER_MAX_CONCURRENT_TASKS=5
LOG_LEVEL=info
SENTRY_DSN=https://...
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
- `RUNPOD_API_KEY`
- `RUNPOD_ENDPOINT_ID`

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
  'RUNPOD_API_KEY',
  'RUNPOD_ENDPOINT_ID',
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
- [ ] Set `RUNPOD_API_KEY`
- [ ] Set `RUNPOD_ENDPOINT_ID`
- [ ] Set `SUPABASE_QUEUE_ENABLED=false` (start disabled)
- [ ] Test with `npm run check-env`
- [ ] Gradually enable with `SUPABASE_QUEUE_ROLLOUT_PERCENT=10`
- [ ] Scale to 100%
- [ ] Deploy workers to RunPod
- [ ] Monitor logs and metrics


