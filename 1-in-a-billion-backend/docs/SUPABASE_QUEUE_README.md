# Supabase Distributed Job Queue - Complete Implementation

## 📦 What You Got

A **production-grade distributed job queue** system designed to scale from **1 → 1,000,000 clients** without requiring a rewrite.

### Architecture

```
┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│  Client  │────▶│   API    │────▶│  Supabase   │◀────│ Workers  │
│   App    │     │ (Hono)   │     │  Postgres   │     │ (RunPod) │
└──────────┘     └──────────┘     └─────────────┘     └──────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │  Supabase   │
                                   │  Storage    │
                                   └─────────────┘
```

### Key Features

✅ **Horizontally scalable** - Add workers to handle more load  
✅ **Distributed locking** - `FOR UPDATE SKIP LOCKED` prevents race conditions  
✅ **No base64 bloat** - All artifacts (MP3/PDF) stored in Supabase Storage  
✅ **Automatic retry** - Failed tasks retry up to 3 times  
✅ **Stale detection** - Watchdog reclaims stuck tasks  
✅ **RLS security** - Users can only see their own jobs  
✅ **Idempotent** - Safe to retry any operation  
✅ **Zero downtime migration** - Gradual cutover from old system  

---

## 📁 Files Delivered

### 1. SQL Migration
- **`migrations/001_supabase_job_queue.sql`** (470 lines)
  - Complete schema: `jobs`, `job_tasks`, `job_artifacts`
  - RPC functions: `claim_tasks`, `heartbeat_task`, `complete_task`, `fail_task`, `reclaim_stale_tasks`
  - RLS policies for security
  - Indexes for performance
  - Triggers for auto-updating job status

### 2. TypeScript Implementation
- **`src/services/supabaseClient.ts`** - Typed Supabase client
- **`src/services/jobQueueV2.ts`** - High-level job management API
- **`src/workers/baseWorker.ts`** - Abstract worker base class
- **`src/workers/audioWorker.ts`** - Concrete TTS worker implementation
- **`src/config/env.ts`** - Updated with Supabase env vars

### 3. Documentation (You Are Here)
- **`docs/IMPLEMENTATION_SUMMARY.md`** - Complete overview
- **`docs/SUPABASE_QUEUE_ARCHITECTURE.md`** - Technical deep dive
- **`docs/API_CONTRACT.md`** - REST API specification
- **`docs/MIGRATION_PLAN.md`** - 5-week gradual rollout plan
- **`docs/ENVIRONMENT_VARIABLES.md`** - All required env vars
- **`docs/SETUP_CHECKLIST.md`** - Step-by-step setup guide
- **`docs/SUPABASE_QUEUE_README.md`** - This file

### 4. Configuration
- **`package.json`** - Updated with `@supabase/supabase-js` dependency
- Worker scripts: `npm run worker:audio`, `npm run worker:text`, etc.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 2. Set Environment Variables
```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_QUEUE_ENABLED=false  # Start disabled
```

### 3. Run SQL Migration
- Copy `migrations/001_supabase_job_queue.sql`
- Paste into Supabase SQL Editor
- Click "Run"

### 4. Create Storage Bucket
- Supabase Dashboard → Storage
- Create bucket: `job-artifacts` (private)

### 5. Test Locally
```bash
npm run worker:audio
```

---

## 📖 Documentation Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **SETUP_CHECKLIST.md** | Step-by-step setup | **Start here** |
| **IMPLEMENTATION_SUMMARY.md** | High-level overview | After setup |
| **SUPABASE_QUEUE_ARCHITECTURE.md** | Technical details | Deep dive |
| **API_CONTRACT.md** | REST API spec | Frontend integration |
| **MIGRATION_PLAN.md** | Gradual rollout | Before production |
| **ENVIRONMENT_VARIABLES.md** | All env vars | Configuration |

---

## 🎯 Migration Path

### Week 1: Dual Write
- Set `SUPABASE_QUEUE_ENABLED=false`
- Deploy code (writes to both systems)
- Test with 1-2 jobs

### Week 2: Gradual Read
- Set `SUPABASE_QUEUE_ENABLED=true`
- Set `SUPABASE_QUEUE_ROLLOUT_PERCENT=10`
- Scale to 50%, then 100%

### Week 3: Workers
- Deploy 1 audio worker to RunPod
- Scale to 3-5 workers

### Week 4: Storage
- Migrate base64 → Storage
- Delete old JSON files

### Week 5: Cleanup
- Remove old code
- Archive `jobs-data/`

**See `MIGRATION_PLAN.md` for full details.**

---

## 💡 Key Concepts

### Jobs vs Tasks
- **Job** = User request (e.g., "Generate Nuclear Package")
- **Task** = Granular work unit (e.g., "Generate audio for Chapter 1")
- 1 job → 16+ tasks (for Nuclear V2)

### Distributed Task Claiming
```sql
SELECT * FROM job_tasks
WHERE status = 'pending'
ORDER BY sequence
LIMIT 5
FOR UPDATE SKIP LOCKED;  ← Magic sauce
```
- No race conditions
- No lock contention
- Workers claim tasks independently

### Storage Strategy
- **Primary:** MP3 (128kbps)
- **Fallback:** M4A (better quality)
- **Never:** WAV (too large)
- **Path:** `{userId}/{jobId}/audio/{taskId}.mp3`

### Retry Logic
- **Worker-side:** 3 attempts with exponential backoff
- **DB-side:** `fail_task()` sets status to `pending` if `attempts < 3`
- **Watchdog:** Reclaims stale tasks every 5 minutes

---

## 📊 Monitoring

### SQL Queries

**Active jobs:**
```sql
SELECT status, COUNT(*) FROM jobs GROUP BY status;
```

**Task backlog:**
```sql
SELECT task_type, status, COUNT(*) 
FROM job_tasks 
GROUP BY task_type, status;
```

**Worker health:**
```sql
SELECT worker_id, COUNT(*) AS active_tasks, MAX(last_heartbeat) AS last_seen
FROM job_tasks
WHERE status IN ('claimed', 'processing')
GROUP BY worker_id;
```

**Stale tasks:**
```sql
SELECT COUNT(*)
FROM job_tasks
WHERE status IN ('claimed', 'processing')
  AND last_heartbeat < (now() - INTERVAL '10 minutes');
```

---

## 🔐 Security

### Environment Variables
- ⚠️ **NEVER commit `.env` to Git**
- ✅ Use GitHub Secrets for CI/CD
- ✅ Rotate keys periodically
- ✅ Separate keys per environment (dev/staging/prod)

### RLS Policies
- **Users:** Can only see their own jobs
- **Workers (service role):** Can claim/update any task
- **Storage:** Users can only read their own artifacts

### Signed URLs
- Artifacts use 1-hour signed URLs
- Client streams audio without auth
- URLs expire automatically

---

## 💰 Cost Estimate

### Supabase (Pro Plan)
- Base: $25/month
- Database: 8GB included + $0.125/GB overage
- Storage: 100GB included + $0.021/GB overage
- Bandwidth: 250GB included + $0.09/GB overage
- **Total: ~$35-50/month**

### RunPod Workers
- 1 worker (A10G): $210/month
- 3 workers: $630/month
- 5 workers: $1,050/month
- **Total: $210-1,050/month** (scale as needed)

### Grand Total: $245-1,100/month
(vs local: $0 but no scale, no reliability)

---

## 🆘 Troubleshooting

### Common Issues

| Error | Solution |
|-------|----------|
| "Supabase not configured" | Check `.env` has all required vars |
| "Failed to claim tasks" | Verify RLS policies in Supabase |
| "Worker stuck / no heartbeat" | Restart worker: `pm2 restart audio-worker` |
| "Tasks stuck in 'claimed'" | Run: `SELECT reclaim_stale_tasks();` |
| "Storage upload failed" | Check bucket exists and policies are correct |

### Debug Commands

```bash
# Check env vars
npm run check-env

# Test worker locally
npm run worker:audio

# View worker logs
pm2 logs audio-worker

# Restart worker
pm2 restart audio-worker

# Check backend logs
pm2 logs iab-backend
```

---

## 🎉 What's Next?

### Phase 1: Get It Working
- [ ] Follow `SETUP_CHECKLIST.md`
- [ ] Test with 1-2 jobs
- [ ] Deploy 1 worker

### Phase 2: Gradual Rollout
- [ ] Follow `MIGRATION_PLAN.md`
- [ ] 10% → 50% → 100% traffic
- [ ] Monitor metrics

### Phase 3: Scale
- [ ] Deploy 3-5 workers
- [ ] Monitor queue depth
- [ ] Auto-scale based on backlog

### Phase 4: Optimize
- [ ] Add WebSocket for real-time updates
- [ ] Implement priority queues
- [ ] Add dead-letter queue
- [ ] Set up Datadog/Sentry

---

## 📞 Support

### In This Codebase
- Start with `SETUP_CHECKLIST.md`
- Read `IMPLEMENTATION_SUMMARY.md` for overview
- Check `MIGRATION_PLAN.md` before production

### External Resources
- [Supabase Docs](https://supabase.com/docs)
- [RunPod Docs](https://docs.runpod.io)
- [Postgres FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)

---

## ✅ Delivered Requirements

| Requirement | Status | File |
|-------------|--------|------|
| SQL schema + RLS | ✅ | `migrations/001_supabase_job_queue.sql` |
| RPC functions | ✅ | Same file |
| Worker architecture | ✅ | `src/workers/baseWorker.ts` |
| API contract | ✅ | `docs/API_CONTRACT.md` |
| Migration plan | ✅ | `docs/MIGRATION_PLAN.md` |
| Environment vars | ✅ | `docs/ENVIRONMENT_VARIABLES.md` |
| Setup checklist | ✅ | `docs/SETUP_CHECKLIST.md` |
| Audio serving (MP3/M4A) | ✅ | Architecture doc |
| No base64 in DB | ✅ | Storage integration |
| Horizontal scaling | ✅ | Worker design |
| Idempotency | ✅ | Task claiming + artifacts |

---

**Ready to build? Start with `SETUP_CHECKLIST.md`!** 🚀


