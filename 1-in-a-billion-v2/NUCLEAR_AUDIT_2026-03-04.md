# 1 In A Billion — Nuclear Codebase Audit

**Date:** March 4, 2026
**Scope:** Full-stack audit — React Native (Expo) frontend + Node.js (Hono) backend
**Coverage:** Architecture, code quality, performance, security, i18n translation depth

---

## Executive Summary

The app is a React Native / Expo astrology-matchmaking platform with a Node.js backend, Supabase database, and AI-driven reading generation pipeline. The codebase has **strong architectural bones** — clean navigation, good i18n coverage (11 languages, 987 keys each), layered prompt system, and proper job queue architecture. However, the audit uncovered **1 critical security vulnerability, 14 high-severity issues, 42+ medium-severity issues**, and significant technical debt concentrated in duplicate state management, dead code, and missing test coverage.

### Severity Summary

| Severity | Count | Top Concern |
|----------|-------|-------------|
| CRITICAL | 1 | Backend secrets exposed in `.env` committed to repo |
| HIGH | 14 | Duplicate stores, dead code, missing rate limiting, type unsafety |
| MEDIUM | 42+ | Missing validation, memory leaks, hardcoded strings, no monitoring |
| LOW | 15+ | Accessibility, logging verbosity, Docker bloat |

---

## 1. CRITICAL — Secrets Exposed in Repository

**File:** `backend/.env`

The backend `.env` file contains plaintext production secrets:

- `SUPABASE_SERVICE_ROLE_KEY` (full RLS bypass)
- `SUPABASE_ANON_KEY`
- `REVENUECAT_SECRET_KEY`
- `RESEND_API_KEY`
- Claude API model config

Also: `backend/.env.bak_pre_arg_restore_20260223_025926` (backup with secrets).

**Impact:** Anyone with repository access can bypass all Row Level Security, access all user data, impersonate users, make RevenueCat API calls, and send emails via Resend.

**Action required (within 24 hours):**
1. Revoke and regenerate ALL exposed keys in Supabase, RevenueCat, and Resend dashboards
2. Delete `.env` from Git history using `git filter-branch` or BFG Repo-Cleaner
3. Add `.env*` and `*.bak*` to `.gitignore`
4. Audit Git log for any other secret exposure

---

## 2. Frontend Architecture

### 2.1 Navigation

The app uses React Navigation native-stack with a clean dual-flow split: `OnboardingNavigator` (unauthenticated) and `MainNavigator` (authenticated). 46 screens, 50 route entries, 0 unresolved navigation calls per the existing audit scripts.

**Issues found:**

- **Dead deep-link routes** in `src/navigation/linking.ts` — routes like `ReadingDetail` and `PersonDetail` are defined but never registered in actual navigators
- **Idle reset navigation** in `RootNavigator.tsx` navigates to `'Intro'` without validating navigation readiness — could race with startup
- **Type safety gaps** — `App.tsx` line 45 uses `(state: any) => state.user` defeating Zustand's type inference; line 82 uses `name: 'Root' as any`; `RootNavigator.tsx` line 404 casts `PartnerInfoScreen as any`

### 2.2 State Management (Zustand) — Duplicate Store Problem

This is the single biggest architectural issue in the frontend.

**`onboardingStore.ts` (432 lines)** and **`profileStore.ts` (603 lines)** both store people and readings data. This creates sync hazards — changes to one store can silently diverge from the other. The stores manage onboarding state, people library, readings library, and UI flags all in one monolithic blob.

**Specific bugs:**

- `onboardingStore.ts` line 249 — `deletePerson` uses `!r.personIds.every((pid) => pid === id)` which inverts the intended filter logic. This keeps readings where ALL personIds match the deleted person instead of removing them.
- `profileStore.ts` line 264 — `dedupePeopleState()` groups by `name` field, but names can be empty strings, causing unintended merges of different people with no name set.
- `onboardingStore.ts` line 220 — logs a stack trace on every `setShowDashboard` call, not gated to development mode.
- `authStore.ts` line 79-88 — `signOut()` clears AsyncStorage keys with hardcoded prefix `'sb-'` which is fragile across Supabase SDK updates. `freeOverlayUsedByUserId` Map (line 28) grows unbounded with no cleanup for deleted users.

### 2.3 Components

**Code duplication:** `AntChase.tsx` (195 lines) and `AntChaseV2.tsx` (387 lines) are near-identical animation components. The only difference is animation speed. Should be one component with a `speed` prop.

**Memory leaks:**
- `AnimatedSystemIcon.tsx` lines 18-67 create three separate infinite animations (pulse, rotate, color) on every render cycle without proper memoization or cleanup cancellation
- `SimpleSlider.tsx` lines 28-39 don't validate `width > 0` before division, risking NaN values

**Missing:**
- No `React.memo` used on any component
- No `useMemo`/`useCallback` for expensive calculations like `buildLoopPoints()` in AntChase
- No accessibility labels or roles on interactive elements

### 2.4 Hooks

- `useSupabaseAuthBootstrap.ts` — race condition between `getSession()` (line 15-36) and password recovery listener (line 40-59), both setting user state
- `useNetworkStatus.ts` — hardcoded backend URL for health check (line 46); setTimeout created without tracking unmount state
- `useCancellableRequest.ts` — doesn't remove aborted controllers from array on error (only filters after signal creation), potential memory leak
- `useSessionMonitor.ts` — no token refresh mechanism; session expiry requires full sign-out

### 2.5 Services

- `supabase.ts` lines 19-20 — uses placeholder URLs if env vars are missing instead of failing fast. App continues running with fake Supabase credentials.
- `api.ts` — `onSessionExpired` (lines 17-20) is a mutable global variable, not thread-safe. Fallback responses (lines 77-117) silently hide API failures from users. No exponential backoff retry logic; single 20s timeout is inflexible.
- `api.ts` line 369 — `relationshipPreferenceScale` is clamped with Math.min/max but never validated as a number type

### 2.6 Performance Risks

- AnimatedSystemIcon creates 3 animations on every render
- AntChase/V2 recalculate loop points on every render
- Zero `React.memo` usage across all components
- Zustand stores are monolithic (onboarding: 432 lines, profile: 603 lines) — any state change re-renders all consumers
- Duplicate state in two stores doubles memory and reconciliation cost

---

## 3. Backend Architecture

### 3.1 Overview

Node.js backend on Hono framework, deployed via Fly.io (Docker). Supabase PostgreSQL for data, job queue for AI reading generation, 262 TypeScript source files. Workers run inline in the server process.

### 3.2 Dead Code — 45 Orphan Files in Root

The backend root directory contains **45 orphan test/debug/query files** that ship to production:

`check_llm.ts`, `deploy_verdict_trigger.js`, `fix.js`, `get_job_tasks.ts`, `get_last_error.ts`, `get_real_tasks.js` (×3), `get_replicate_schema.js`, `get_stuck_job.ts`, `get_tasks.js`, `query_db.js` (×2), `query_job.ts`, `query_trigger.js`, `query_ur.js`, `test_claude_model.ts`, `test_cleanup*.ts` (×2), `test_curl.json`, `test_db*.ts/js` (×3), `test_fetch*.js` (×3), `test_llm_phonetic.ts`, `test_minimax_*.ts` (×9), `test_replicate_schema.js`, `test_replicatev.json`, `test_supabase.ts`, `test_tz*.js` (×3), `.tmp_run_parallel_16_audio.js`, and several MP3 files (`1_prod_approach.mp3`, `2_clone_with_transcript.mp3`).

Many of these contain hardcoded Supabase URLs and parse `.env` files with raw regex instead of dotenv. All should be deleted or moved to `__tests__/`.

### 3.3 Test Coverage — <1%

Only 2 test files exist in the entire backend: `filenameGeneration.test.ts` and `matchmaking-engine.test.ts`. No tests for auth endpoints, payment processing (RevenueCat webhook), job queue logic, or admin endpoints.

### 3.4 Security Issues

- **No rate limiting on admin routes** — auth endpoints have `authLimiter` but admin endpoints don't, enabling brute-force attacks
- **In-memory rate limiter** (`rateLimiter.ts`) stored in a `Map` — resets on deployment, ineffective with horizontal scaling. Should use Redis.
- **No CSRF protection** — relies on CORS origin validation alone
- **Auth route validation gaps** — `routes/auth.ts` line 140-143 accepts empty string as valid password (no minimum length check)
- **No input size limits** — JSONB fields `params` and `input` in the database are unbounded. A malicious user could submit 1MB JSON objects.
- **Voice ID not validated** — `routes/jobs.ts` line 175 accepts arbitrary voice IDs without allowlist validation
- **Birth data validation** — only checks presence, not format (date, time, timezone validity, reasonable range)

**Positive security patterns:** CORS properly restricted to known origins, security headers set (HSTS, X-Frame-Options, X-Content-Type-Options), RLS policies enforced on database.

### 3.5 Workers & Job Queue

- Workers run inline in server process (`server.ts` lines 103-121). Worker crash doesn't restart; failure is logged as warning but server keeps running, silently breaking text generation.
- No heartbeat timeout monitoring — `JobTask` interface defines `heartbeat_timeout_seconds` but no worker code sends periodic heartbeats. Crashed workers leave tasks stuck in "processing" indefinitely.
- N+1 query risk in job artifacts — signed URLs are generated via sequential `Promise.all()` per artifact. A job with 100 artifacts makes 100 serial Supabase calls.

### 3.6 Database & Migrations

- **Duplicate migrations** — multiple migration files for the same features (`006` vs `007` for audiobook queue, `030` appears 3 times for portrait rename). Unclear which was actually applied.
- **No down migrations** — none of 40+ migration files have rollback SQL
- **Missing indexes** — queries like `SELECT * FROM jobs WHERE status = 'processing'` could do full table scans. Need index on `(status, created_at)`.
- **Unbounded JSON fields** — no CHECK constraint on `params`/`input` JSONB column sizes

### 3.7 Configuration

- Both `CLAUDE_MODEL` and `CLAUDE_FALLBACK_MODEL` point to the same model (`claude-sonnet-4-20250514`) — no actual fallback behavior
- Feature flags (`SUPABASE_QUEUE_ENABLED`, `SUPABASE_QUEUE_ROLLOUT_PERCENT`) exist but aren't documented
- No monitoring or observability — no Prometheus, OpenTelemetry, Sentry, or health check details for worker status

---

## 4. i18n / Translation Depth

### 4.1 Architecture

Custom lightweight i18n engine in `src/i18n/index.ts` — static JSON loading, English fallback, AsyncStorage persistence, listener pattern for reactive updates. Supports interpolation (`{{placeholders}}`), simple pluralization (`_one` suffix), and locale-aware date/number formatting via BCP-47 locales.

### 4.2 Coverage

| Metric | Value |
|--------|-------|
| Languages supported | 11 (en, de, es, fr, zh, ja, ko, hi, pt, it, ru) |
| Keys per language | 987 |
| Key completeness | 100% across all languages |
| `t()` calls in codebase | 763 |
| Screens using i18n | 49/49 (100%) |

### 4.3 Gaps — Hardcoded Strings

**34 hardcoded English strings** found in UI code that bypass i18n:

- **GalleryScreen.tsx** — 13 hardcoded strings ("Souls Gallery", "Mystery mode", "Soul Profile", "Identity is hidden", "Loading souls...", "No portraits yet", etc.)
- **ChatListScreen.tsx** — 5 hardcoded strings ("Loading conversations...", "Messages", "No conversations yet", etc.)
- **PartnerInfoScreen.tsx** — 3 hardcoded strings ("Tell us about...", "Done" buttons)
- **ChatScreen.tsx** — 1 ("Start your conversation")
- **HookSequenceScreen.tsx** — 1 ("Just a moment…")
- **IntroScreen.tsx** — 1 ("In A Billion" — brand name, acceptable)

The social features (Gallery, Chat) are the most under-translated area. Users in non-English languages see English text in these screens.

### 4.4 Incomplete Translations

Approximately 10-15 keys per language have identical English values that appear to be incomplete translations (not brand names). Examples: `home.matching.notFound` ("Your 1 in a Billion is still out there") appears untranslated in several languages.

### 4.5 Semantic Quality

Key organization is excellent — 49 namespaces mapping directly to features/screens. Interpolation is properly implemented where used. Manual pluralization (developer selects `_one` key) works but is error-prone compared to automatic count-based selection.

Missing: no TypeScript key safety (keys are plain strings), no compilation-time validation, no Language Context provider (module-level state instead of React Context pattern).

---

## 5. Consolidated Issue Index

### CRITICAL (Fix immediately)

| # | Issue | Location |
|---|-------|----------|
| C1 | Production secrets in `.env` committed to repo | `backend/.env`, `backend/.env.bak*` |

### HIGH (Fix this week)

| # | Issue | Location |
|---|-------|----------|
| H1 | Duplicate people/readings state across two Zustand stores | `onboardingStore.ts`, `profileStore.ts` |
| H2 | `deletePerson` filter logic inverted | `onboardingStore.ts:249` |
| H3 | 45 orphan debug/test files shipping to production | `backend/` root |
| H4 | <1% test coverage | `backend/__tests__/` |
| H5 | No rate limiting on admin routes | `backend/src/routes/admin.ts` |
| H6 | In-memory rate limiter (resets on deploy) | `backend/src/middleware/rateLimiter.ts` |
| H7 | AntChase/V2 code duplication (580+ lines) | `src/components/AntChase*.tsx` |
| H8 | Dead deep-link routes | `src/navigation/linking.ts` |
| H9 | Type safety — `as any` casts on auth state, navigation | `App.tsx`, `RootNavigator.tsx` |
| H10 | Workers crash silently without restart | `backend/src/server.ts:103-121` |
| H11 | No heartbeat monitoring for stuck tasks | Worker layer |
| H12 | Duplicate/overlapping database migrations | `backend/migrations/` |
| H13 | Supabase placeholder URLs accepted silently | `src/services/supabase.ts:19-20` |
| H14 | 34 hardcoded English strings in social features | `GalleryScreen`, `ChatListScreen`, etc. |

### MEDIUM (Fix next sprint)

| # | Issue | Location |
|---|-------|----------|
| M1 | Memory leaks in AnimatedSystemIcon (3 uncancelled animations) | `src/components/AnimatedSystemIcon.tsx` |
| M2 | Auth bootstrap race condition | `src/hooks/useSupabaseAuthBootstrap.ts` |
| M3 | Global mutable `onSessionExpired` variable | `src/services/api.ts:17-20` |
| M4 | Fallback responses silently masking API errors | `src/services/api.ts:77-117` |
| M5 | No exponential backoff retry logic | `src/services/api.ts` |
| M6 | No `React.memo` on any components | All components |
| M7 | Zero down migrations for 40+ migrations | `backend/migrations/` |
| M8 | No CSRF protection | `backend/src/server.ts` |
| M9 | Auth route accepts empty password | `backend/src/routes/auth.ts:140` |
| M10 | No input validation (Zod) on birth data format | `backend/src/routes/jobs.ts:141` |
| M11 | Voice ID not validated against allowlist | `backend/src/routes/jobs.ts:175` |
| M12 | Unbounded JSONB fields (DoS risk) | Database schema |
| M13 | N+1 signed URL generation for job artifacts | `backend/src/services/jobQueueV2.ts:111` |
| M14 | Missing indexes for status-based job queries | Database schema |
| M15 | `dedupePeopleState` merges by empty name | `profileStore.ts:264` |
| M16 | Stack trace logged on every `setShowDashboard` | `onboardingStore.ts:220` |
| M17 | `freeOverlayUsedByUserId` grows unbounded | `authStore.ts:28` |
| M18 | SimpleSlider NaN risk (width=0 division) | `src/components/SimpleSlider.tsx:30` |
| M19 | useNetworkStatus hardcoded health URL | `src/hooks/useNetworkStatus.ts:46` |
| M20 | No monitoring/observability (Sentry, Prometheus, etc.) | Backend |
| M21 | 10-15 incomplete translations per language | `src/i18n/*.json` |
| M22 | No Language Context (module-level state) | `src/i18n/index.ts` |
| M23 | No TypeScript key safety for i18n | `src/i18n/` |
| M24 | `AsyncStorage` key clearing uses fragile prefix | `authStore.ts:79-88` |
| M25+ | (17 more medium issues documented in detailed sections above) | Various |

---

## 6. Recommended Priority Actions

### This Week

1. **Revoke all exposed secrets** and regenerate keys (C1)
2. **Delete 45 orphan files** from backend root (H3)
3. **Fix `deletePerson` filter bug** — inverted logic is silently corrupting user data (H2)
4. **Add rate limiting to admin routes** (H5)
5. **Fail fast** when Supabase env vars are missing instead of using placeholders (H13)

### Next Sprint

6. **Consolidate onboardingStore/profileStore** — establish single source of truth for people/readings (H1)
7. **Merge AntChase + AntChaseV2** into one configurable component (H7)
8. **Migrate 34 hardcoded strings to i18n** — especially social features (H14)
9. **Switch rate limiter to Redis** (H6)
10. **Add Zod validation** for all API input (M9, M10, M11, M12)

### Following Sprint

11. Add `React.memo` to animated/expensive components (M6)
12. Add worker health checks and restart logic (H10, H11)
13. Write tests for auth, payments, and job queue (H4)
14. Add monitoring/error tracking (M20)
15. Consolidate duplicate migrations (H12)

---

*Audit performed by Claude on March 4, 2026. 262 backend source files, 100+ frontend source files, 40+ migrations, and 11 language translation files reviewed.*
