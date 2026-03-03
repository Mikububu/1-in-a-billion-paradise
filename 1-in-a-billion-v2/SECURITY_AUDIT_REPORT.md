# COMPREHENSIVE SECURITY AUDIT REPORT
## 1-in-a-billion-v2: React Native + Expo App with Node.js/Hono Backend

**Audit Date:** March 3, 2026
**Codebase:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/`
**Tech Stack:** React Native, Expo, Hono (Node.js backend), Supabase, BullMQ/Redis, Claude API, Replicate API, RevenueCat

---

## EXECUTIVE SUMMARY

The codebase demonstrates **good security fundamentals** with proper secrets management, authentication, authorization, and input validation. However, there are **several moderate to critical findings** that require attention, particularly around the payment bypass feature, data exposure in admin endpoints, and incomplete beta key enforcement.

**Total Findings:** 14 (1 Critical, 5 High, 5 Medium, 3 Low)

---

## DETAILED FINDINGS

### 1. PAYMENT BYPASS ENABLED IN PRODUCTION (.env)

**Severity:** 🔴 **CRITICAL**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/.env` (Line 21)

**Finding:**
```
EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=true
```

**Risk:**
- This environment variable is **publicly accessible** in the React Native app (EXPO_PUBLIC prefix)
- Users can check `env.ALLOW_PAYMENT_BYPASS` in memory/through debugging
- If this is a **production build**, all users can bypass subscription checks
- Code shows this is checked in multiple places: `RootNavigator.tsx`, `SignInScreen.tsx`, `PricingScreen.tsx`, `chatRenewal.ts`

**Evidence:**
```typescript
// src/navigation/RootNavigator.tsx:552
if (env.ALLOW_PAYMENT_BYPASS) {
    setEntitlementStatus('active');
    setEntitlementState('active');
    return;
}

// src/screens/onboarding/IntroScreen.tsx:276
if (env.ALLOW_PAYMENT_BYPASS) {
    // Skip paywall logic
}
```

**Recommendation:**
- Set `EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=false` for production builds immediately
- Use build-time secrets to inject bypass only for internal QA builds
- Implement server-side verification: even if client bypasses payment, backend should verify entitlement via RevenueCat/subscription service
- Consider using Expo secrets or encrypted config for sensitive flags

**Priority:** Fix immediately before production release.

---

### 2. SUPABASE ANON KEY EXPOSED IN .env (Publicly Readable)

**Severity:** 🔴 **CRITICAL**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/.env` (Line 3)

**Finding:**
```
EXPO_PUBLIC_SUPABASE_ANON_KEY=***REDACTED_SUPABASE_ANON_KEY***
```

**Risk:**
- This JWT token is **hardcoded in the repo** and visible in source control
- Valid until year 2080 (expiration: `exp:2080098078`)
- While the anon key has restricted permissions (RLS enforces), it could be used to:
  - Query data from tables without proper RLS policies
  - Enumerate users or brute force user IDs
  - Test for RLS bypass vulnerabilities
- **If the repo is public or accessible**, this key is compromised

**Recommendation:**
- **Rotate the Supabase anon key immediately** in the Supabase dashboard
- Use `.env.example` for documentation only (not actual keys)
- Verify all commits in git history are cleaned (use `git-filter-repo` or BFG to remove from history)
- Implement Supabase RLS policies audit (see section 10)
- Consider: can backend issue short-lived tokens instead of embedding anon key?

---

### 3. REVENUECAT API KEY EXPOSED IN .env (iOS)

**Severity:** 🟠 **HIGH**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/.env` (Line 9)

**Finding:**
```
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_ohwFtPMszsCdrimhSdjuEKFbwcg
```

**Risk:**
- RevenueCat public API keys are **meant to be public** by design (for SDK initialization)
- **However**, if this is hardcoded, it exposes the specific app and could allow attackers to:
  - Modify RevenueCat configuration at the client level (though SDK is read-only)
  - Enumerate subscription tiers and pricing
  - Perform denial-of-service against the app's RevenueCat integration

**Recommendation:**
- This is acceptable to be in .env for client apps (public keys by design)
- However, verify server-side: backend `verifyRevenueCatWebhookAuth()` uses REVENUECAT_SECRET_KEY (not exposed) ✅ (Good)
- Continue to keep the secret key (`REVENUECAT_SECRET_KEY`) in backend `.env` only

---

### 4. ADMIN ROUTES RETURN SENSITIVE USER METADATA WITHOUT FILTERING

**Severity:** 🟠 **HIGH**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/routes/admin.ts` (Line 56)

**Finding:**
```typescript
router.get('/users', requirePermission('users', 'read'), async (c) => {
  let query = supabase
    .from('users')
    .select('id, email, raw_user_meta_data, created_at, last_sign_in_at', { count: 'exact' })
```

**Risk:**
- Admin endpoint returns `raw_user_meta_data` for all users
- This field may contain sensitive information: phone numbers, profile pictures, personal metadata
- No filtering or sanitization of returned data
- If admin account is compromised, attacker gets PII for all users

**Similar Issues:**
- `/api/admin/users/:userId` returns full user object via `supabase.auth.admin.getUserById(userId)`
- `/api/admin/subscriptions` returns full subscription metadata including metadata fields

**Recommendation:**
- Implement a data filtering layer that removes sensitive fields before returning:
  ```typescript
  // Only expose safe fields
  const safeUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at
  }));
  ```
- Audit other admin endpoints for similar data leaks
- Consider: do admins need phone numbers, profile pictures? If not, don't return them.

---

### 5. DEV DASHBOARD EXPOSES ALL JOB DATA TO AUTHENTICATED USERS (No Admin Check)

**Severity:** 🟠 **HIGH**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/routes/devDashboard.ts` (Line 30)

**Finding:**
```typescript
// All dev dashboard routes require authentication
router.use('/*', requireAuth);

router.get('/dashboard', async (c) => {
  const supabaseJobs = await supabase
    .from('jobs')
    .select('id, type, status, progress, created_at, updated_at, error')
    .order('created_at', { ascending: false })
    .limit(100);
```

**Risk:**
- Dev dashboard allows **any authenticated user** to see:
  - All jobs (not just their own)
  - Job status, progress, errors
  - Potential access to other users' sensitive data
- No permission check; just `requireAuth`
- This should be **admin-only** or scoped to user's own jobs

**Recommendation:**
- Add `requireAdminAuth` or `requirePermission('dashboard', 'read')` middleware
- Or filter to return only user's own jobs:
  ```typescript
  const userId = c.get('userId');
  const userJobs = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId);
  ```
- Audit other routes in `devDashboard.ts` for similar issues

---

### 6. CORS ORIGINS ARE HARDCODED (Not Configurable for Deployment)

**Severity:** 🟠 **HIGH**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/server.ts` (Lines 35-46)

**Finding:**
```typescript
app.use('*', cors({
  origin: [
    'https://1-in-a-billion.app',
    'https://www.1-in-a-billion.app',
    'http://localhost:8081',       // Expo dev
    'http://localhost:19006',      // Expo web dev
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));
```

**Risk:**
- **localhost origins in production** (if deployed to production)
- Hardcoded origins mean you can't easily add new domains without recompiling
- If these localhost origins are enabled in production, any local app can make requests
- `env.ALLOWED_ORIGINS` exists but is not used in the CORS config (Line 104 in `env.ts`)

**Recommendation:**
```typescript
const allowedOrigins = [
  'https://1-in-a-billion.app',
  'https://www.1-in-a-billion.app',
  ...(__DEV__ ? ['http://localhost:8081', 'http://localhost:19006'] : []),
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []),
];

app.use('*', cors({
  origin: allowedOrigins,
  // ... rest of config
}));
```
- Remove localhost from production builds
- Make origins configurable via environment variables

---

### 7. RATE LIMITER FAILS OPEN (Security Risk During Failures)

**Severity:** 🟠 **HIGH**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/middleware/rateLimiter.ts` (Lines 107-110)

**Finding:**
```typescript
} catch {
  // Rate limiter error — fail open so the request still goes through
  await next();
}
```

**Risk:**
- If rate limiter crashes or throws, **requests pass through without any limit**
- In-memory store resets on server restart, losing all rate limit history
- Could be exploited: if attacker triggers rate limiter error, they bypass limits
- No metrics/logging of rate limiter failures

**Recommendation:**
- Log failures: `logger.error('Rate limiter failure', { error })`
- Consider: should we fail closed (reject request) instead of open?
  ```typescript
  } catch (err) {
    logger.error('Rate limiter error', { err });
    return c.json({ error: 'Service temporarily unavailable' }, 503);
  }
  ```
- Consider: use Redis-backed rate limiter for persistence (not in-memory)
- Test rate limiter failure scenarios

---

### 8. ADMIN PANEL SECRET USES TIMING-SAFE COMPARISON (Good!) BUT INCONSISTENTLY APPLIED

**Severity:** 🟡 **MEDIUM**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/routes/coupons.ts` (Lines 18-25)

**Finding:**
```typescript
function verifyAdminSecret(c: Context): boolean {
  const secret = c.req.header('x-admin-secret');
  if (!env.ADMIN_PANEL_SECRET || !secret) {
    return false;
  }
  const expected = Buffer.from(env.ADMIN_PANEL_SECRET, 'utf8');
  const actual = Buffer.from(secret, 'utf8');
  return timingSafeEqual(expected, actual);
}
```

**Good:** Uses `timingSafeEqual` to prevent timing attacks on secret comparison ✅

**Risk:**
- Only applied to `/api/coupons` and `/api/internal/people-scaling` routes
- What about other admin operations that might need `ADMIN_PANEL_SECRET`?
- Inconsistent application of security check

**Recommendation:**
- Create a reusable middleware: `verifyAdminSecret()`
- Apply to all internal routes requiring admin secret
- Document which endpoints require which auth (JWT vs. admin secret vs. both)

---

### 9. INPUT VALIDATION IS GOOD BUT INCOMPLETE IN SOME ROUTES

**Severity:** 🟡 **MEDIUM**

**File:** Various route files

**Findings:**
- ✅ Auth routes validate email and password format
- ✅ Admin routes use Zod for schema validation (e.g., `userListSchema`)
- ✅ Sanitization utilities exist: `sanitizeForLLM()`, `sanitizeInput()`

**However:**
- Not all routes use Zod or validation
- Example: `/api/dev/dashboard` accepts no query params but doesn't validate
- LLM input sanitization is good (strips prompt delimiters, control chars) but verify all user input goes through it

**Recommendation:**
- Audit all routes for input validation
- Require Zod schemas for all POST/PUT endpoints
- Consider: global request validator middleware

---

### 10. SUPABASE RLS POLICIES ARE INCOMPLETE (Storage-Only, No Table RLS Audit)

**Severity:** 🟡 **MEDIUM**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/supabase_storage_policies.sql`

**Finding:**
- Only storage RLS policies are defined (job-artifacts bucket)
- **No audit of table-level RLS policies** for `users`, `jobs`, `profiles`, `user_subscriptions`, etc.
- Unknown if tables have proper RLS policies to prevent users from querying other users' data

**Risk:**
- If a table doesn't have RLS, service_role (backend) bypasses it
- If anon key is used for user queries, RLS should block access to other users' data
- Without seeing the actual RLS policies, cannot confirm data isolation

**Recommendation:**
- Audit/document all RLS policies on production tables
- Ensure: users can only read/write their own data
- Test: verify RLS prevents cross-user data access
- Enable RLS logging to detect policy violations
- Example policy:
  ```sql
  CREATE POLICY "Users can read own profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
  ```

---

### 11. REVENUECAT WEBHOOK SIGNATURE VERIFICATION ONLY USES BEARER TOKEN (No Signature Hash)

**Severity:** 🟡 **MEDIUM**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/services/revenuecatService.ts` (Lines 66-79)

**Finding:**
```typescript
export async function verifyRevenueCatWebhookAuth(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const secret = await getRevenueCatSecretKey();
  if (!secret || !token) return false;
  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length) return false;
    return timingSafeEqual(tokenBuf, secretBuf);
  } catch {
    return false;
  }
}
```

**Analysis:**
- ✅ Uses `timingSafeEqual` to prevent timing attacks (Good!)
- ✅ Secret is loaded from Supabase, not hardcoded

**However:**
- RevenueCat webhooks should also include an X-Signature header with HMAC-SHA256 of the body
- This implementation only checks Bearer token, not the body signature
- If secret is leaked, attacker can forge webhooks with any payload

**Recommendation:**
- Add body signature verification:
  ```typescript
  const crypto = require('crypto');
  const signature = c.req.header('x-revenuecat-signature');
  const body = await c.req.text();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }
  ```
- Check RevenueCat webhook documentation for exact signature format
- Verify the webhook request's timestamp to prevent replay attacks

---

### 12. BETA KEY CONFIGURATION EXISTS BUT NOT ENFORCED IN ROUTES

**Severity:** 🟡 **MEDIUM**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/config/env.ts` (Line 34)

**Finding:**
```typescript
BETA_KEY: process.env.BETA_KEY ?? '',
```

**Documentation states:**
"If set, backend requires header: X-BETA-KEY: <value> for /api/jobs/* endpoints"

**Risk:**
- Beta key configuration exists but is **not actually enforced** in any route
- No middleware checks for X-BETA-KEY header
- Routes can be accessed without the beta key even if configured

**Recommendation:**
- Remove the beta key feature (not implemented) OR
- Implement it properly:
  ```typescript
  export function betaKeyMiddleware(c: Context, next: Next) {
    if (env.BETA_KEY) {
      const provided = c.req.header('x-beta-key');
      if (provided !== env.BETA_KEY) {
        return c.json({ error: 'Beta key required' }, 403);
      }
    }
    await next();
  }

  app.use('/api/jobs/*', betaKeyMiddleware);
  ```
- Or remove from codebase if not needed

---

### 13. ERROR MESSAGES MIGHT LEAK INTERNAL DETAILS IN EDGE CASES

**Severity:** 🟡 **MEDIUM**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/utils/safeError.ts`

**Finding:**
```typescript
// If the message is short and doesn't look internal, it's probably safe
if (msg.length < 200 && !msg.includes('/') && !msg.includes('\\')) {
  return msg;
}
```

**Risk:**
- The heuristic (length < 200) might not catch all internal errors
- Example: "relation "jobs" does not exist" is < 200 chars but is a DB schema detail
- Pattern matching has gaps; some Postgres errors might slip through

**Recommendation:**
- Whitelist safe error messages instead of blacklist:
  ```typescript
  const SAFE_MESSAGES = {
    'PGRST116': 'Not found',
    'ACCOUNT_EXISTS': 'Account already exists',
    // etc.
  };

  // Only return safe messages or generic error
  return SAFE_MESSAGES[code] || 'An unexpected error occurred';
  ```
- Test error handling with edge cases

---

### 14. PII LOGGED IN NOTIFICATION SERVICE (Emails in Logs)

**Severity:** 🟢 **LOW**

**File:** `/sessions/focused-youthful-allen/mnt/big-challenge/1-in-a-billion-v2/backend/src/services/notificationService.ts`

**Finding:**
```typescript
console.log(`📧 [EMAIL WOULD BE SENT] To: ${email}, Subject: ${subject}`);
console.log(`✅ Email sent to ${email} (Resend ID: ${data.id})`);
console.log(`✅ Found user email via fallback: ${userProfile.email}`);
```

**Risk:**
- Email addresses (PII) are logged to stdout
- If logs are aggregated to a logging service, PII might be exposed
- Not critical if logs are properly secured, but violates privacy best practices

**Recommendation:**
- Sanitize PII in logs:
  ```typescript
  const sanitizedEmail = email.replace(/(.{2})[^@]*(@.*)/, '$1***$2'); // user@*** domain
  console.log(`✅ Email sent to ${sanitizedEmail}`);
  ```
- Or use a structured logger that can filter PII fields
- Mark fields as PII so logging systems can redact them

---

## SUMMARY TABLE

| # | Finding | Severity | Category | Status |
|---|---------|----------|----------|--------|
| 1 | Payment bypass enabled in production | CRITICAL | Feature Flag | Requires Fix |
| 2 | Supabase anon key exposed in .env | CRITICAL | Secrets | Requires Fix |
| 3 | RevenueCat API key in .env | HIGH | Secrets | Design-OK* |
| 4 | Admin endpoints return unfiltered PII | HIGH | Data Exposure | Requires Fix |
| 5 | Dev dashboard accessible to all auth users | HIGH | Authorization | Requires Fix |
| 6 | CORS origins hardcoded with localhost | HIGH | Configuration | Requires Fix |
| 7 | Rate limiter fails open | HIGH | DoS Protection | Requires Fix |
| 8 | Admin secret inconsistently applied | MEDIUM | Authorization | Inconsistent |
| 9 | Input validation incomplete | MEDIUM | Injection | Partial |
| 10 | RLS policies not audited | MEDIUM | Authorization | Unknown |
| 11 | RevenueCat webhook lacks body signature | MEDIUM | Webhooks | Requires Enhancement |
| 12 | Beta key not enforced | MEDIUM | Feature Flag | Not Implemented |
| 13 | Error message heuristics weak | MEDIUM | Info Disclosure | Risky |
| 14 | PII logged in notifications | LOW | Privacy | Best Practice |

*RevenueCat public keys are meant to be public by design, but exposing them in hardcoded .env is still not ideal.

---

## POSITIVE FINDINGS (Security Strengths)

✅ **Excellent:**
1. `.env` and `backend/.env` are in `.gitignore` - secrets won't be committed
2. Backend `.env` exists and is properly excluded from git
3. Supabase JWT authentication is correctly implemented with Bearer tokens
4. RequireAuth middleware validates tokens server-side
5. Admin middleware uses `requirePermission()` with role-based checks
6. RevenueCat webhook uses timing-safe comparison (`timingSafeEqual`)
7. Error handler properly sanitizes error messages before returning to clients
8. Input sanitization utilities for LLM prompts (prevents injection)
9. Security headers are set (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
10. Rate limiting is implemented (in-memory, though not Redis-backed)
11. Supabase storage has RLS policies defined
12. Admin actions are logged (`logAdminAction` function exists)
13. Passwords are handled via Supabase (not rolling own auth)

---

## IMMEDIATE ACTION REQUIRED

**Before any production release:**

1. ✅ **CRITICAL:** Set `EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=false` in production .env
2. ✅ **CRITICAL:** Rotate Supabase anon key (it's exposed in repo)
3. ✅ **HIGH:** Filter PII from admin `/api/admin/users*` responses
4. ✅ **HIGH:** Restrict dev dashboard to admin users only
5. ✅ **HIGH:** Remove localhost from CORS origins in production
6. ✅ **HIGH:** Improve rate limiter fail-close behavior

---

## DEPLOYMENT CHECKLIST

- [ ] All CRITICAL findings resolved
- [ ] All HIGH findings resolved
- [ ] Supabase RLS policies audited and documented
- [ ] Production .env values set correctly
- [ ] CORS origins configured for production domain only
- [ ] Rate limiter tested for failure scenarios
- [ ] Admin endpoints tested for data leakage
- [ ] Error handling tested (no internal details leaked)
- [ ] Logging audit (no PII in logs)
- [ ] RevenueCat webhook signature verification tested

---

## RECOMMENDATIONS FOR FUTURE IMPROVEMENTS

1. **Migrate rate limiter to Redis** (production-ready, persistent across restarts)
2. **Implement structured logging** (JSON logs with PII redaction)
3. **Add API monitoring** (detect unusual patterns, brute force attempts)
4. **Rotate secrets regularly** (quarterly basis, use secrets manager)
5. **Conduct penetration testing** (before launch, especially payment flows)
6. **Implement WebAuthn/passkeys** (more secure than passwords)
7. **Add end-to-end encryption** (for sensitive user data like readings)
8. **Database query monitoring** (detect slow/suspicious queries)
