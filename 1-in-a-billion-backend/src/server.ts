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
import notificationsRouter from './routes/notifications';
import paymentsRouter from './routes/payments';
import peopleRouter from './routes/people';
import { startAutoScaling } from './services/runpodScaler';
import { preloadApiKeys } from './services/apiKeys';
import './services/jobHealthCheck'; // Auto-starts job health check service

const app = new Hono();

// CORS middleware - allow all origins for mobile apps
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

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
app.route('/api/notifications', notificationsRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/people', peopleRouter);

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

// Start RunPod auto-scaler (monitors queue depth and scales workers)
if (process.env.ENABLE_AUTO_SCALER !== 'false') {
  startAutoScaling().catch(err => {
    console.warn('⚠️ Auto-scaler failed to start:', err.message);
  });
}

serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`🚀 Backend running on http://localhost:${env.PORT}`);

