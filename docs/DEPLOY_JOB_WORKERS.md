# JOB WORKER DEPLOYMENT GUIDE

## Problem
Jobs are stuck in `queued` status because worker processes are not running on Fly.io.

## Root Cause
The `fly.toml` file had **empty process definitions**:
```toml
[processes]
  app = ""
  worker = ""
  audiobook-worker = ""
```

This meant Fly.io was only running the default command (likely just the API server), and **no workers were started** to claim and process tasks from the Supabase job queue.

## Solution
Updated `fly.toml` with proper entrypoints:
```toml
[processes]
  app = "node dist/server.js"
  worker = "node dist/workers/textWorker.js & node dist/workers/pdfWorker.js"
  audiobook-worker = "node dist/workers/audioWorker.js"
```

## Process Groups Explained

### 1. `app` (API Server)
- **Command**: `node dist/server.js`
- **Purpose**: Handles HTTP requests (job creation, status checks, etc.)
- **Port**: 8787
- **Scaling**: Should always have at least 1 instance running

### 2. `worker` (Text + PDF Worker)
- **Command**: `node dist/workers/textWorker.js & node dist/workers/pdfWorker.js`
- **Purpose**: Claims and processes `text_generation` and `pdf_generation` tasks
- **Tasks**:
  - `textWorker.js`: LLM text generation for readings
  - `pdfWorker.js`: PDF generation from text artifacts
- **Scaling**: Can scale to 0 when no jobs, auto-scales up when jobs are queued

### 3. `audiobook-worker` (Audio Worker)
- **Command**: `node dist/workers/audioWorker.js`
- **Purpose**: Claims and processes `audio_generation` tasks
- **Tasks**: Generates audio from text using TTS (RunPod or local)
- **Scaling**: Can scale to 0 when no audio jobs

## Prerequisites

Before deploying, ensure the following tools and access are available on the machine you use (local or CI):

- `node` (v16+ recommended) and `npm`
- `psql` (for running local SQL or applying migrations) — https://www.postgresql.org/download/
- `flyctl` for Fly.io deployments — https://fly.io/docs/hands-on/install-flyctl/
- `supabase` CLI (optional for SQL + functions) — https://supabase.com/docs/guides/cli
- Logged-in sessions for CLIs: `flyctl auth login` and `supabase login`
- Access to the Supabase project and ability to run SQL editor queries
- CI alternative: If CLIs are not available in CI runners, use the Supabase SQL editor and GitHub Actions with `supabase`/`flyio` actions

Notes:
- Add required secrets as deployment-level secrets (Fly.io `flyctl secrets set` or GitHub Actions secrets) and do NOT commit them to the repo. Use placeholders like `<SUPABASE_SERVICE_ROLE_KEY>` in docs.
- Verify `migrations/` have been applied in staging before applying to production.

## Deployment Steps

### 1. Build TypeScript
```bash
npm run build
```

### 2. Deploy to Fly.io
```bash
flyctl deploy
```

### 3. Scale Worker Processes
By default, Fly.io may not start worker processes. You need to explicitly scale them:

```bash
# Scale the worker process group (text + PDF workers)
flyctl scale count worker=1 --app 1-in-a-billion-backend

# Scale the audiobook-worker process group (audio workers)
flyctl scale count audiobook-worker=1 --app 1-in-a-billion-backend
```

### 4. Verify Workers Are Running
```bash
# Check all running machines
flyctl status --app 1-in-a-billion-backend

# Check logs for worker process
flyctl logs --app 1-in-a-billion-backend
```

You should see log output like:
```
🤖 BaseWorker initialized: text_generation (worker-xyz-123)
▶️ BaseWorker started: text_generation
```

## Environment Variables Required

Make sure these are set in Fly.io secrets:

```bash
flyctl secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  LLM_PROVIDER="deepseek" \
  DEEPSEEK_API_KEY="your-deepseek-key" \
  --app 1-in-a-billion-backend
```

For audio workers (if using RunPod):
```bash
flyctl secrets set \
  RUNPOD_API_KEY="your-runpod-key" \
  RUNPOD_ENDPOINT_ID="your-endpoint-id" \
  VOICE_SAMPLE_URL="https://..." \
  --app 1-in-a-billion-backend
```

## Monitoring

### Check Queue Stats
```bash
# Run this script to see pending tasks
npm run ts-node scripts/check_active_jobs.ts
```

### Check Worker Logs
```bash
# Real-time logs
flyctl logs --app 1-in-a-billion-backend

# Filter for worker logs only
flyctl logs --app 1-in-a-billion-backend | grep "BaseWorker\|TextWorker\|PdfWorker"
```

### Expected Log Output
When a worker claims a task:
```
📋 Claimed 1 task(s): text_generation
🎯 Processing task abc-123 (text_generation)
✅ Task abc-123 complete
```

## Troubleshooting

### Jobs Still Stuck in `queued`
1. **Check if workers are running**:
   ```bash
   flyctl status --app 1-in-a-billion-backend
   ```
   You should see multiple machines, not just the `app` process.

2. **Check worker logs**:
   ```bash
   flyctl logs --app 1-in-a-billion-backend
   ```
   Look for "BaseWorker started" messages.

3. **Manually scale workers**:
   ```bash
   flyctl scale count worker=1 --app 1-in-a-billion-backend
   ```

4. **Confirm the job/task health check is active (stuck task cleanup)**:
   - The API server starts a background service that periodically runs DB cleanup functions for stuck jobs/tasks.
   - If the cleanup migration isn’t applied, jobs can remain stuck forever when a worker dies mid-task.
   - Migration: `migrations/021_add_timeouts_and_retries.sql`

### Workers Start But Don't Claim Tasks
1. **Check SUPABASE_SERVICE_ROLE_KEY**: Workers need the service role key (not anon key) to bypass RLS
2. **Check database functions**: Ensure `claim_tasks` RPC exists in Supabase
3. **Check task types**: Workers only claim tasks matching their `taskTypes` array

### Audio Jobs Not Processing
- Audio workers are separate (`audiobook-worker` process group)
- They may be on RunPod instead of Fly.io (see `DEPLOY_AUDIOBOOK_WORKER.md`)
- For Fly.io audio workers, ensure `audiobook-worker` process group is scaled up

## Architecture Notes

### Why Separate Process Groups?
- **API (`app`)**: Always running, handles HTTP requests
- **Workers (`worker`)**: Can scale to 0 when idle, saves costs
- **Audio Workers (`audiobook-worker`)**: Separate because audio generation is GPU-intensive

### Task Flow
1. User creates job via API → Job inserted into `jobs` table
2. Trigger creates tasks in `job_tasks` table (status: `pending`)
3. Worker calls `claim_tasks` RPC → Tasks move to `claimed` status
4. Worker processes task → Updates status to `processing`
5. Worker completes task → Uploads artifacts, marks task as `complete`
6. Trigger checks if all tasks complete → Marks job as `complete`

### Scaling Strategy
- **Development**: 1 API + 1 worker + 0 audio workers
- **Production**: 2+ API + 2+ workers + 1+ audio workers (auto-scale based on queue depth)

## Quick Fix Checklist
- [x] Fix empty process definitions in `fly.toml`
- [ ] Build TypeScript: `npm run build`
- [ ] Deploy: `flyctl deploy`
- [ ] Scale workers: `flyctl scale count worker=1`
- [ ] Verify: `flyctl logs` should show "BaseWorker started"
- [ ] Verify: health check is running (periodic stuck job/task cleanup)
- [ ] Test: Create a job and watch it move from `queued` → `processing` → `complete`
