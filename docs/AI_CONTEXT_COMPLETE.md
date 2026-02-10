# 1 IN A BILLION - AI CONTEXT (Complete)

> **Last Updated:** December 27, 2025  
> **Owner:** Michael Wogenburg (call him "Michael", NEVER "Perin")

---

## ⚠️ HIGHEST PRIORITY RULE

**MICHAEL'S LAPTOP MUST NOT BE NEEDED FOR THE APP TO WORK.**

- ALL backend processes run in the cloud (Fly.io + Replicate + MiniMax)
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
- **Workers:** Fly.io (text workers)
- **TTS:** Chatterbox Turbo via Replicate
- **Songs:** MiniMax Music 2.5
- **LLM:** DeepSeek (primary) / Claude 3.5 Sonnet (backup)

### Key Directories
```
1-in-a-billion-backend/
├── src/
│   ├── routes/          # API endpoints (jobs.ts, audio.ts)
│   ├── services/        # Core logic (swissEphemeris, jobQueueV2)
│   ├── workers/         # Workers (textWorker, audioWorker, songWorker)
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
| **Replicate TTS** | Chatterbox Turbo model | Audio generation |
| **MiniMax** | Music 2.5 API | Song generation |
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

## 🔄 JOB QUEUE V2 (Supabase + Fly.io Workers)

### Tables
- `jobs` - Main job record (user_id, type, status, progress, params)
- `job_tasks` - Individual tasks (text_generation, audio_generation, song_generation)
- `job_artifacts` - Storage references (MP3, PDF, text files, songs)

### Flow
1. API creates job + 16 `text_generation` tasks
2. Fly.io TextWorker claims tasks, generates text, uploads to Storage
3. SQL trigger auto-enqueues `audio_generation` task when text completes
4. AudioWorker calls Replicate (Chatterbox Turbo) for TTS
5. SongWorker calls MiniMax Music 2.5 for song generation
6. Job auto-completes when all tasks done

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

# Replicate (Audio/TTS)
REPLICATE_API_TOKEN=...
REPLICATE_CHUNK_DELAY_MS=11000

# MiniMax (Songs)
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...

# Voice Sample
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
- **Actions:** Auto-deploys to Fly.io on push to `main`

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

## 🚨 CRITICAL ARCHITECTURAL DECISION (Dec 27, 2025) - RESOLVED

### The Problem: RunPod Serverless Audio Generation Failed at Scale

**What We Discovered:**
- Audio generation jobs stuck in `IN_QUEUE` for hours on RunPod
- Serverless endpoints have hard concurrency limits
- Large jobs (audiobooks: 30-40 chunks) failed completely

### The Solution: Replicate + Rate-Limited Sequential Processing

**Current Architecture (Implemented):**
- **Audio/TTS**: Replicate Chatterbox Turbo with rate-limit handling
- **Songs**: MiniMax Music 2.5 API
- **Text Workers**: Fly.io

**Key Changes:**
1. Moved from RunPod to Replicate for TTS (simpler API, better reliability)
2. Sequential chunk processing with configurable delays (`REPLICATE_CHUNK_DELAY_MS`)
3. Rate-limit aware processing (accounts with < $5 credit get 6 requests/minute)

**See `REPLICATE_RATE_LIMITS.md` for detailed rate limit handling**

---

## ✅ CURRENT STATUS (Feb 2026)

- [x] Supabase configured (keys in .env)
- [x] SQL migrations run (001 through 017+)
- [x] Storage bucket `job-artifacts` created
- [x] Test user created in Supabase Auth
- [x] LLM code centralized (DeepSeek primary, Claude backup)
- [x] **Job progress tracking FIXED** (Migration 004)
- [x] **Audio generation via Replicate** (Chatterbox Turbo)
- [x] **Song generation via MiniMax** (Music 2.5)
- [x] Workers deployed to Fly.io
- [x] GitHub Actions auto-deploy on push to `main`

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

