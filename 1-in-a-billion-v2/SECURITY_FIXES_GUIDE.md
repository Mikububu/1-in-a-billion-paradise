# Security Fixes Implementation Guide

## Quick Fixes for Critical Issues

This guide provides code examples for fixing the security vulnerabilities found in the audit.

---

## 1. FIX PAYMENT BYPASS (CRITICAL)

**File:** `.env`

**Current (BROKEN):**
```
EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=true
```

**Fixed:**
```
EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=false
```

**Additional Fix - Server-Side Verification:**

File: `backend/src/routes/payments.ts`

```typescript
/**
 * Verify user entitlement (NEW: Mandatory server-side check)
 * Even if client bypasses payment, backend ensures user has active subscription
 */
payments.post('/verify-entitlement', async (c) => {
  try {
    const userId = await getAuthUserId(c);
    if (!userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    // Check subscription status from Supabase
    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('status, subscription_tier')
      .eq('user_id', userId)
      .single();

    if (error || !sub || sub.status !== 'active') {
      return c.json({ success: false, error: 'No active subscription' }, 403);
    }

    return c.json({
      success: true,
      tier: sub.subscription_tier,
      verified: true
    });
  } catch (error: any) {
    return c.json({ success: false, error: 'Verification failed' }, 500);
  }
});
```

---

## 2. FIX ADMIN ENDPOINTS PII LEAKAGE (HIGH)

**File:** `backend/src/routes/admin.ts` (Line 56)

**Current (LEAKS DATA):**
```typescript
router.get('/users', requirePermission('users', 'read'), async (c) => {
  let query = supabase
    .from('users')
    .select('id, email, raw_user_meta_data, created_at, last_sign_in_at', { count: 'exact' })
```

**Fixed:**
```typescript
// Helper to filter sensitive data
function sanitizeUserData(user: any) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    // NOTE: raw_user_meta_data is explicitly NOT included
  };
}

router.get('/users', requirePermission('users', 'read'), async (c) => {
  let query = supabase
    .from('users')
    .select('id, email, created_at, last_sign_in_at', { count: 'exact' })
    // ... rest of query

  const { data: users, error, count } = await query;

  if (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }

  // Apply sanitization before returning
  return c.json({
    users: (users || []).map(sanitizeUserData),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
});

// Also fix single user endpoint
router.get('/users/:userId', requirePermission('users', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const userId = c.req.param('userId');

    // Get user via Supabase auth API
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Return ONLY safe fields
    return c.json({
      success: true,
      user: sanitizeUserData(user),
    });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

---

## 3. FIX DEV DASHBOARD EXPOSURE (HIGH)

**File:** `backend/src/routes/devDashboard.ts`

**Current (EXPOSES ALL JOBS):**
```typescript
router.use('/*', requireAuth);

router.get('/dashboard', async (c) => {
  // ... gets ALL jobs
  const supabaseJobs = await supabase
    .from('jobs')
    .select('id, type, status, progress, created_at, updated_at, error')
    .order('created_at', { ascending: false })
    .limit(100);
```

**Fixed (ADMIN ONLY):**
```typescript
// Add admin requirement
router.use('/*', requireAuth);
router.use('/*', requireAdminAuth);  // NEW: Admin check

// Or if you want to allow users to see their own jobs:
router.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get user's own jobs only
    const { data: userJobs, error: userJobsError } = await supabase
      .from('jobs')
      .select('id, type, status, progress, created_at, updated_at, error')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (userJobsError) {
      return c.json({ error: 'Failed to fetch jobs' }, 500);
    }

    return c.json({
      jobs: userJobs || [],
      queue: 'supabase',
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return c.json({ error: 'Internal error' }, 500);
  }
});
```

---

## 4. FIX CORS ORIGINS (HIGH)

**File:** `backend/src/server.ts`

**Current (HAS LOCALHOST):**
```typescript
app.use('*', cors({
  origin: [
    'https://1-in-a-billion.app',
    'https://www.1-in-a-billion.app',
    'http://localhost:8081',       // REMOVE in production
    'http://localhost:19006',      // REMOVE in production
  ],
```

**Fixed:**
```typescript
// Determine if we're in development
const isDev = process.env.NODE_ENV === 'development' || !process.env.FLY_REGION;

const allowedOrigins = [
  'https://1-in-a-billion.app',
  'https://www.1-in-a-billion.app',
  ...(isDev ? [
    'http://localhost:8081',
    'http://localhost:19006',
  ] : []),
  // Add additional origins from environment
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []),
];

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));
```

---

## 5. FIX RATE LIMITER FAIL-OPEN (HIGH)

**File:** `backend/src/middleware/rateLimiter.ts`

**Current (FAILS OPEN):**
```typescript
} catch {
  // Rate limiter error — fail open so the request still goes through
  await next();
}
```

**Fixed (FAILS CLOSED WITH LOGGING):**
```typescript
import { logger } from '../utils/logger';

// ... in createRateLimiter:

  return async (c: Context, next: Next) => {
    // Wrap everything — if rate limiting fails, fail closed
    try {
      const key = keyGenerator(c);
      const store = stores.get(name);
      if (!store) {
        // Store not initialized - log error and fail closed
        logger.error('Rate limiter store not initialized', { limiter: name });
        return c.json({ error: 'Service temporarily unavailable' }, 503);
      }

      const now = Date.now();
      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

      if (entry.timestamps.length >= maxRequests) {
        const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
        c.header('Retry-After', String(retryAfter));
        c.header('X-RateLimit-Limit', String(maxRequests));
        c.header('X-RateLimit-Remaining', '0');
        return c.json({ success: false, error: message }, 429);
      }

      // Record this request
      entry.timestamps.push(now);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests - entry.timestamps.length));

      await next();
    } catch (err) {
      // Rate limiter error — fail closed for safety
      logger.error('Rate limiter exception', {
        limiter: name,
        error: err instanceof Error ? err.message : String(err)
      });
      return c.json({
        success: false,
        error: 'Service temporarily unavailable'
      }, 503);
    }
  };
```

---

## 6. FIX REVENUECAT WEBHOOK SIGNATURE (MEDIUM)

**File:** `backend/src/services/revenuecatService.ts`

**Current (NO BODY SIGNATURE):**
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

**Fixed (INCLUDES BODY SIGNATURE):**
```typescript
import { createHmac } from 'crypto';

/**
 * Verify webhook signature: RevenueCat uses HMAC-SHA256 of body
 * Header format: X-RevenueCat-Signature: <base64-encoded-signature>
 */
export async function verifyRevenueCatWebhookSignature(
  body: string,
  signature: string | undefined
): Promise<boolean> {
  if (!signature) return false;

  const secret = await getRevenueCatSecretKey();
  if (!secret) return false;

  try {
    // Create HMAC-SHA256 signature of body
    const expectedSignature = createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    // Use timing-safe comparison
    const expectedBuf = Buffer.from(expectedSignature, 'base64');
    const providedBuf = Buffer.from(signature, 'base64');

    if (expectedBuf.length !== providedBuf.length) return false;

    return timingSafeEqual(expectedBuf, providedBuf);
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
}

// Update webhook endpoint to use both checks
export async function verifyRevenueCatWebhookAuth(
  authHeader: string | undefined,
  bodyText: string,
  signatureHeader: string | undefined
): Promise<boolean> {
  // Check Bearer token (original check)
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const secret = await getRevenueCatSecretKey();
  if (!secret || !token) return false;

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length) return false;
    const tokenValid = timingSafeEqual(tokenBuf, secretBuf);

    if (!tokenValid) return false;

    // Also verify body signature
    return await verifyRevenueCatWebhookSignature(bodyText, signatureHeader);
  } catch {
    return false;
  }
}
```

**Update in payments.ts:**
```typescript
payments.post('/webhook', async (c) => {
  try {
    // Get raw body for signature verification
    const bodyText = await c.req.text();
    const authHeader = c.req.header('Authorization');
    const signatureHeader = c.req.header('X-RevenueCat-Signature');

    // Verify both bearer token AND body signature
    const valid = await verifyRevenueCatWebhookAuth(
      authHeader,
      bodyText,
      signatureHeader
    );

    if (!valid) {
      console.warn('RevenueCat webhook: invalid or missing Authorization/Signature');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    // Parse body (using cached bodyText)
    const body = JSON.parse(bodyText) as RevenueCatWebhookBody;
    // ... rest of logic
```

---

## 7. CREATE REUSABLE ADMIN SECRET MIDDLEWARE (MEDIUM)

**File:** `backend/src/middleware/adminSecret.ts` (NEW)

```typescript
import { Context, Next } from 'hono';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';

/**
 * Middleware to verify admin panel secret.
 * Used for internal operations triggered from admin panel.
 */
export async function requireAdminSecret(c: Context, next: Next) {
  const secret = c.req.header('x-admin-secret');

  if (!env.ADMIN_PANEL_SECRET) {
    // Admin secret not configured
    return c.json({ error: 'Admin secret not configured' }, 500);
  }

  if (!secret) {
    return c.json({ error: 'Unauthorized: Missing admin secret' }, 401);
  }

  try {
    const expected = Buffer.from(env.ADMIN_PANEL_SECRET, 'utf8');
    const actual = Buffer.from(secret, 'utf8');

    if (expected.length !== actual.length) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!timingSafeEqual(expected, actual)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Secret verified, proceed
    await next();
  } catch (err) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
```

**Update files to use it:**

File: `backend/src/routes/coupons.ts`

```typescript
import { requireAdminSecret } from '../middleware/adminSecret';

const coupons = new Hono<AppEnv>();

// Apply admin secret verification to all routes
coupons.use('/*', requireAdminSecret);

// Now you can remove the inline verification
// Routes are already protected
```

---

## 8. FIX ERROR MESSAGE SANITIZATION (MEDIUM)

**File:** `backend/src/utils/safeError.ts`

**Current (HEURISTIC-BASED):**
```typescript
export function safeErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (!error) return fallback;

  const msg = error instanceof Error ? error.message : String(error);

  // ... checks ...

  // If the message is short and doesn't look internal, it's probably safe
  if (msg.length < 200 && !msg.includes('/') && !msg.includes('\\')) {
    return msg;
  }

  return fallback;
}
```

**Fixed (WHITELIST-BASED):**
```typescript
// Whitelist of known safe error messages for specific codes
const SAFE_MESSAGES: Record<string, string> = {
  // PostgreSQL/Supabase codes
  'PGRST116': 'Not found',
  'PGRST205': 'Service unavailable',
  '23505': 'A record with this information already exists',
  '23503': 'Referenced record not found',
  '42501': 'Access denied',
  '42P01': 'Service temporarily unavailable',
  '23502': 'Required field missing',

  // Supabase auth codes
  'over_email_send_rate_limit': 'Too many email requests. Please try again later.',
  'invalid_grant': 'Invalid email or password',
  'user_already_exists': 'Account already exists. Please sign in.',
  'weak_password': 'Password is too weak',
};

export function safeErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (!error) return fallback;

  // Check for known error code first
  if (typeof error === 'object' && error !== null) {
    const code = (error as any).code;
    if (code && SAFE_MESSAGES[code]) {
      return SAFE_MESSAGES[code];
    }
  }

  const msg = error instanceof Error ? error.message : String(error);

  // Check if message is in our safe list
  if (msg && SAFE_MESSAGES[msg]) {
    return SAFE_MESSAGES[msg];
  }

  // Default: return fallback for any unexpected message
  return fallback;
}
```

---

## 9. SANITIZE PII IN LOGS (LOW)

**File:** `backend/src/services/notificationService.ts`

**Current (LOGS EMAIL):**
```typescript
console.log(`📧 [EMAIL WOULD BE SENT] To: ${email}, Subject: ${subject}`);
console.log(`✅ Email sent to ${email} (Resend ID: ${data.id})`);
console.log(`✅ Found user email via fallback: ${userProfile.email}`);
```

**Fixed (SANITIZES EMAIL):**
```typescript
// Helper to sanitize email for logging
function sanitizeEmailForLogging(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***@***';

  // Show first 2 chars of user, rest redacted
  const masked = user.substring(0, 2) + '***';
  return `${masked}@${domain}`;
}

// Updated logs:
const sanitizedEmail = sanitizeEmailForLogging(email);
console.log(`📧 [EMAIL WOULD BE SENT] To: ${sanitizedEmail}, Subject: ${subject}`);
console.log(`✅ Email sent to ${sanitizedEmail} (Resend ID: ${data.id})`);
console.log(`✅ Found user email via fallback: ${sanitizeEmailForLogging(userProfile.email)}`);
```

---

## Testing Your Fixes

After implementing fixes, test them:

```bash
# Test payment bypass is disabled
# Check that EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=false in production build

# Test admin PII filtering
curl https://backend.fly.dev/api/admin/users \
  -H "Authorization: Bearer <admin-token>"
# Should only see: id, email, created_at, last_sign_in_at

# Test dev dashboard requires admin
curl https://backend.fly.dev/api/dev/dashboard \
  -H "Authorization: Bearer <regular-user-token>"
# Should get 401 Unauthorized

# Test CORS with localhost (should fail in production)
curl https://backend.fly.dev/api/health \
  -H "Origin: http://localhost:8081"
# Should get CORS error in production

# Test rate limiter failure handling
# (Harder to test - requires chaos testing)

# Test webhook signature
curl https://backend.fly.dev/api/payments/webhook \
  -X POST \
  -H "Authorization: Bearer <secret>" \
  -H "X-RevenueCat-Signature: <invalid-sig>" \
  -d '{...}'
# Should get 401 Unauthorized
```

---

## Deployment Verification Checklist

- [ ] EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS=false (checked in build)
- [ ] Supabase anon key rotated
- [ ] Admin endpoints return only safe fields
- [ ] Dev dashboard requires admin auth
- [ ] CORS origins don't include localhost in production
- [ ] Rate limiter fails closed (tests pass)
- [ ] RevenueCat webhook signature verified
- [ ] Admin secret middleware applied
- [ ] Error messages don't leak internals
- [ ] Logs sanitized of PII
- [ ] All fixes code reviewed
- [ ] Tests written and passing
