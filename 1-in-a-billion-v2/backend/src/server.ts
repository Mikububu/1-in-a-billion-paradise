import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env';
import { readingsRouter } from './routes/readings';
import { matchesRouter } from './routes/matches';
import { audioRouter } from './routes/audio';
import { pdfRouter } from './routes/pdf';
import jobsRouter from './routes/jobs';
import devDashboardRouter from './routes/devDashboard';
import { compatibilityRouter } from './routes/compatibility';
import citiesRouter from './routes/cities';
import accountRouter from './routes/account';
import { authRouter } from './routes/auth';
import { voicesRouter } from './routes/voices';
import vedicRouter from './routes/vedic';
import vedicV2Router from './routes/vedic_v2';
import adminRouter from './routes/admin';
import internalPeopleScalingRouter from './routes/internalPeopleScaling';
import notificationsRouter from './routes/notifications';
import paymentsRouter from './routes/payments';
import peopleRouter from './routes/people';
import profileRouter from './routes/profile';
import couplesRouter from './routes/couples';
import chatRouter from './routes/chat';
import couponsRouter from './routes/coupons';
import { preloadApiKeys } from './services/apiKeys';
import { globalLimiter, authLimiter, llmLimiter, webhookLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import './services/jobHealthCheck'; // Auto-starts job health check service

const app = new Hono();

// CORS middleware - restrict to known origins
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

// Global error handler — must be first middleware
app.use('*', errorHandler);

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Rate limiting - applied globally, tighter on auth & AI endpoints
app.use('*', globalLimiter);
app.use('/api/auth/*', authLimiter);
app.use('/api/jobs/*', llmLimiter);
app.use('/api/payments/webhook', webhookLimiter);

app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Swiss Ephemeris health check
app.get('/health/ephemeris', async (c) => {
  const { swissEngine } = await import('./services/swissEphemeris');
  const result = await swissEngine.healthCheck();
  return c.json(result);
});

app.route('/api/reading', readingsRouter);
app.route('/api/match', matchesRouter);
app.route('/api/audio', audioRouter);
app.route('/api/pdf', pdfRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/dev', devDashboardRouter);
app.route('/api/compatibility', compatibilityRouter);
app.route('/api/cities', citiesRouter);
app.route('/api/account', accountRouter);
app.route('/api/auth', authRouter);
app.route('/api/voices', voicesRouter);
app.route('/api/vedic', vedicRouter);
app.route('/api/vedic-v2', vedicV2Router);
app.route('/api/admin', adminRouter);
app.route('/api/internal/people-scaling', internalPeopleScalingRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/people', peopleRouter);
app.route('/api/profile', profileRouter);
app.route('/api/couples', couplesRouter);
app.route('/api/chat', chatRouter);
app.route('/api/coupons', couponsRouter);

// Start text worker in background (processes Supabase queue)
// No GPU needed - just calls DeepSeek API
if (process.env.ENABLE_TEXT_WORKER !== 'false') {
  import('./workers/textWorker').then(({ TextWorker }) => {
    const worker = new TextWorker();
    worker.start();
    console.log('📝 Text worker started in background');
  }).catch(err => {
    console.warn('Text worker not started:', err.message);
  });
}

// NOTE: Song generation runs in the Fly `song-worker` process group.
// We intentionally do NOT run it in the API process to avoid double-claiming tasks.

// Preload API keys from Supabase at startup
preloadApiKeys().catch(err => {
  console.warn('⚠️ API key preload failed (will use env fallback):', err.message);
});

serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`🚀 Backend running on http://localhost:${env.PORT}`);
