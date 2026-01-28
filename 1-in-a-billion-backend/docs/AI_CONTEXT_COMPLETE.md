# 1 IN A BILLION - AI CONTEXT (Complete)

> **Last Updated:** December 27, 2025  
> **Owner:** Michael Wogenburg (call him "Michael", NEVER "Perin")

---

## ⚠️ HIGHEST PRIORITY RULE

**MICHAEL'S LAPTOP MUST NOT BE NEEDED FOR THE APP TO WORK.**

- ALL backend processes run in the cloud (Fly.io/RunPod)
- ALL calculations, readings, audio generation happen on remote servers
- NO local dependencies - app works 24/7 whether Michael's laptop is on or off
- Local development is ONLY for testing/UI changes, NEVER for production operations

---

## 🎯 PROJECT OVERVIEW

React Native/Expo astrology app combining **Western** and **Vedic (Jyotish)** systems for unique personality readings. Backend generates 16-document "Nuclear Package" readings with text, PDF, and audio.

---

## 🏗️ ARCHITECTURE

### Stack
- **Frontend:** React Native / Expo SDK 54 / TypeScript / Zustand
- **Backend:** Hono.js (Node.js) / TypeScript
- **Database:** Supabase (Postgres) - job queue + user data
- **Storage:** Supabase Storage (`job-artifacts` bucket)
- **Workers:** RunPod Serverless (auto-scales 0-50 workers)
- **TTS:** Chatterbox via RunPod (self-hosted)
- **LLM:** Claude 3.5 Sonnet (primary) / DeepSeek (backup)

### Key Directories
```
1-in-a-billion-backend/
├── src/
│   ├── routes/          # API endpoints (jobs.ts, audio.ts)
│   ├── services/        # Core logic (swissEphemeris, jobQueueV2)
│   ├── workers/         # RunPod workers (textWorker, audioWorker)
│   └── prompts/         # LLM prompt templates
├── migrations/          # Supabase SQL migrations
├── scripts/             # stress_test_parallel_readings.ts
└── docs/                # Documentation
```

---

## 🔑 API KEYS & SERVICES

| Service | Key/Endpoint | Usage |
|---------|-------------|-------|
| **Supabase** | `https://qdfikbgwuauertfmkmzk.supabase.co` | Database, Auth, Storage |
| **Claude** | `sk-ant-api03-...vNEgAA` | LLM for all readings |
| **DeepSeek** | `sk-a0730e46...` | Backup LLM |
| **RunPod TTS** | Endpoint `tyj2436ozcz419` | Chatterbox audio |
| **Fal.ai** | `aaae1e11-...` | Alternative TTS (deprecated) |

### Supabase Test User
- **Email:** `stresstest@test.com`
- **UUID:** `962daa9f-5c3a-43a5-8873-745109a04f76`

---

## 👥 TEST PEOPLE (Swiss Ephemeris Verified)

### Michael (Primary Test User)
- **Birth:** August 23, 1968 at 13:45
- **Location:** Villach, Austria (46.6103°N, 13.8558°E)
- **Tropical:** Sun Virgo 0.43°, Moon Leo 24.73°, Rising Sagittarius 4.82°
- **Sidereal:** Sun Leo 7° (Magha), Moon Leo 1° (Magha), Asc Scorpio 11° (Anuradha)

### Charmaine
- **Birth:** November 23, 1983 at 06:25
- **Location:** Hong Kong (22.3193°N, 114.1694°E)
- **Tropical:** Sun Sagittarius 0.05°, Moon Cancer 0.72°, Rising Scorpio 25.85°

### Iya
- **Birth:** March 24, 1998 at 10:45
- **Location:** Tagum, Davao, Philippines (7.4478°N, 125.8078°E)

### Jonathan
- **Birth:** November 8, 1987 at 10:44
- **Location:** London, UK (51.5074°N, 0.1278°W)

### Eva
- **Birth:** July 9, 1974 at 04:15
- **Location:** Jaffa, Tel Aviv, Israel (32.0504°N, 34.7522°E)

### Fabrice
- **Birth:** April 26, 1972 at 08:00
- **Location:** Aix-en-Provence, France (43.5297°N, 5.4474°E)

### Luca
- **Birth:** July 11, 1958 at 10:30
- **Location:** Bologna, Italy (44.4938°N, 11.3387°E)

### Martina
- **Birth:** May 6, 1955 at 12:00 (noon)
- **Location:** Falun, Sweden (60.6074°N, 15.6330°E)

---

## 💑 TEST COUPLES

1. **Michael + Charmaine**
2. **Iya + Jonathan**
3. **Eva + Fabrice**
4. **Luca + Martina**

---

## 📦 NUCLEAR PACKAGE V2 (16 Documents)

The `nuclear_v2` job type generates **16 documents** (~32,000 words total):

### Individual Profiles (10 docs)
For each person (Person 1 & Person 2):
1. Western Astrology Deep Dive
2. Vedic (Jyotish) Deep Dive
3. Human Design Profile
4. Gene Keys Profile
5. Kabbalah Profile

### System Overlays (5 docs)
Compatibility analysis per system:
6. Western Synastry Overlay
7. Vedic Compatibility Overlay
8. Human Design Overlay
9. Gene Keys Overlay
10. Kabbalah Overlay

### Final Verdict (1 doc)
11. Combined synthesis of all systems

---

## 🔄 JOB QUEUE V2 (Supabase + RunPod)

### Tables
- `jobs` - Main job record (user_id, type, status, progress, params)
- `job_tasks` - Individual tasks (text_generation, audio_generation)
- `job_artifacts` - Storage references (MP3, PDF, text files)

### Flow
1. API creates job + 16 `text_generation` tasks
2. RunPod TextWorker claims tasks, generates text, uploads to Storage
3. SQL trigger auto-enqueues `audio_generation` task when text completes
4. RunPod AudioWorker generates MP3 from text
5. Job auto-completes when all tasks done

### Key RPC Functions
- `claim_tasks(worker_id, max_tasks, task_types)` - Worker claims work
- `complete_task(task_id, worker_id, output)` - Mark task done
- `heartbeat_task(task_id, worker_id)` - Keep task alive
- `reclaim_stale_tasks()` - Watchdog cleanup

---

## 🚀 DEVELOPMENT

### Start Backend (Local)
```bash
cd /Users/michaelperinwogenburg/Desktop/1-in-a-billion-app/1-in-a-billion-backend
npm run dev
# Runs on http://localhost:8787
```

### Run Stress Test
```bash
npx ts-node scripts/stress_test_parallel_readings.ts
# Creates 4 nuclear_v2 jobs (one per couple)
```

### Environment Variables (.env)
```env
# Supabase
SUPABASE_URL=https://qdfikbgwuauertfmkmzk.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# LLM
CLAUDE_API_KEY=sk-ant-api03-...
DEEPSEEK_API_KEY=sk-a0730e46...
PAID_LLM_PROVIDER=claude

# RunPod
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=tyj2436ozcz419
VOICE_SAMPLE_URL=https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav
```

---

## 📂 BACKUPS

| Date | Location |
|------|----------|
| Dec 19, 2025 | `BACKUP_20251219_144752/` |
| Dec 24, 2025 | `BACKUP_20251224_095620/` |

All backups at: `/Users/michaelperinwogenburg/Desktop/1-IN-A-BILLION-BACKUPS/`

---

## ⚠️ IMPORTANT RULES

1. **Swiss Ephemeris is the ONLY source of truth** for planetary positions. LLMs NEVER calculate astrology.
2. **All readings in 3rd person** using the person's NAME ("Michael's Leo Moon..."), never "you".
3. **Never switch LLM providers** (Claude ↔ DeepSeek) without Michael's explicit approval.
4. **Audio playback:** Use QuickTime Player, not Apple Music.
5. **Be proactive:** Start servers, run tests, commit code automatically.

---

## 🔗 GITHUB

- **Repo:** `Mikububu/1-in-a-billion-backend`
- **Actions:** Auto-deploys to RunPod on push to `main`

---

## 🔄 LLM PROVIDER SWITCHING

**Single source of truth:** `src/services/llm.ts`

**To switch providers:**
```bash
# In .env
LLM_PROVIDER=deepseek   # Current default
LLM_PROVIDER=claude     # For Claude Sonnet
LLM_PROVIDER=openai     # For GPT-4
```

**All code paths now use this centralized service:**
- `textWorker.ts` → `llm.generate()`
- `jobs.ts` → `llm.generate()`
- `deepseekClient.ts` → `llm.generateStreaming()`

---

## 🚨 CRITICAL ARCHITECTURAL DECISION (Dec 27, 2025)

### The Problem: RunPod Serverless Audio Generation Fails at Scale

**What We Discovered:**
- Audio generation jobs stuck in `IN_QUEUE` for hours
- RunPod `/runsync` endpoint returns async job IDs (`{id, status: 'IN_QUEUE'}`) instead of synchronous audio
- Small jobs (free readings: 3 chunks) work fine
- Large jobs (audiobooks: 30-40 chunks) fail completely
- Jobs never progress from `IN_QUEUE` → `COMPLETED`

**Root Cause Analysis (via GPT-4):**
1. **`/runsync` is not a guarantee** - It's a "best effort" synchronous shortcut that degrades to async when jobs exceed internal sync execution window
2. **Serverless endpoints have hard concurrency limits** (10-50 jobs) - We were submitting 30-40 chunks in parallel per user, overwhelming the endpoint
3. **Parallel chunking at scheduler level** - We chunked text and submitted chunks in parallel, multiplying concurrency by 30-40x
4. **Serverless is for short bursts, not sustained batch workloads** - Audiobooks require long GPU occupancy, not quick inference
5. **No explicit backpressure** - When capacity exceeded, jobs were accepted but never scheduled, causing silent failure

**The Fundamental Mistake:**
We treated audiobook generation as a **synchronous request/response problem** instead of a **batch processing problem**. This forced us into serverless `/runsync`, parallel chunking, and polling patterns that are incompatible with long-running GPU work at scale.

### The Solution: Persistent GPU Workers + Queue Architecture

**New Architecture (Not Yet Implemented):**

```
Users → API (Job Creation) → Queue (Redis/Postgres) → Persistent GPU Workers → Storage
```

**Key Components:**
1. **Intake Layer** - API creates job records immediately, returns job_id (no GPU work)
2. **Queue Layer** - Jobs wait in durable queue (Redis Streams or Postgres-based)
3. **Execution Layer** - Persistent GPU pods on RunPod, each processes 1 chapter at a time
4. **Delivery Layer** - Audio stored in object storage, clients poll for status

**Why This Works:**
- User concurrency ≠ GPU concurrency (1000 users can queue jobs, only 20 GPUs process them)
- Explicit backpressure (queue depth controls GPU scaling)
- Deterministic throughput (N pods = N concurrent chapters)
- No silent queue starvation (jobs wait safely in queue)
- Linear scalability (add pods = add throughput)

**Hybrid Approach:**
- Keep serverless `/runsync` ONLY for short previews (< 1000 chars) - instant UX
- Route all audiobook generation to queue → persistent workers
- This keeps UX fast for previews while protecting backend from collapse

**Recommended Implementation Plan:**
1. Database schema: `audiobook_jobs` + `audiobook_chapters` tables
2. Queue system: Redis Streams or Postgres-based queue
3. Persistent GPU workers: Node.js/Python workers that pull from queue, process 1 chapter at a time
4. Autoscaler: Scale GPU pods based on queue depth (start with 1 pod, scale up as queue fills)
5. Replace current `audioWorker.ts` serverless calls with queue-based approach

**Status:** Architecture decision made, implementation not yet started. Current system still uses serverless `/runsync` (broken for large jobs).

**References:**
- GPT-4 architectural analysis (Dec 27, 2025)
- RunPod serverless endpoint limitations
- Industry standard: All serious TTS/audiobook platforms use persistent workers + queue

---

## ✅ CURRENT STATUS (Dec 27, 2025)

- [x] Supabase configured (keys in .env)
- [x] SQL migrations run (001 + 002 + 003 + 004)
- [x] Storage bucket `job-artifacts` created
- [x] Test user created in Supabase Auth
- [x] LLM code centralized (one provider, one env var)
- [x] **Job progress tracking FIXED** (Migration 004)
- [x] **Architectural decision made** - Moving to persistent GPU workers + queue (see above)
- [ ] Persistent GPU workers + queue implementation (NOT STARTED - next priority)
- [ ] RunPod workers processing jobs (CURRENTLY BROKEN - see above)
- [ ] GitHub Secrets configured for production deploy

---

## 🐛 RECENT FIX: Job Progress Tracking (Dec 25, 2025)

### Problem
Frontend was stuck at "0% and waiting..." even though backend workers were actively processing tasks and completing them successfully.

### Root Cause
Database trigger `auto_update_job_status()` had a bug on line 452:
```sql
WHERE ... AND status != 'processing'
```
This meant the progress percentage only updated on the FIRST task completion (when status changed from `queued` to `processing`). All subsequent task completions were ignored.

### Solution
**Migration 004** (`migrations/004_fix_job_progress_tracking.sql`):
- Removed the `AND status != 'processing'` condition
- Now updates progress on EVERY task completion
- Added better progress messages: `"Processing... (5/16 tasks complete)"`

### How to Apply
1. Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new
2. Paste migration SQL (already in clipboard or at `migrations/004_fix_job_progress_tracking.sql`)
3. Click "Run"
4. Test with a fresh Nuclear Reading job

### Expected Behavior After Fix
- Progress updates from 0% → 6% → 12% → ... → 100%
- Frontend shows real-time updates every ~30-60 seconds
- Chapter names appear as text completes
- Audio icons light up as audio completes

**Full Documentation:** `docs/PROGRESS_TRACKING_FIX.md`

