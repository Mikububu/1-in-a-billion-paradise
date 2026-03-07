"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const env_1 = require("./config/env");
const readings_1 = require("./routes/readings");
const matches_1 = require("./routes/matches");
const audio_1 = require("./routes/audio");
const pdf_1 = require("./routes/pdf");
const jobs_1 = __importDefault(require("./routes/jobs"));
const devDashboard_1 = __importDefault(require("./routes/devDashboard"));
const compatibility_1 = require("./routes/compatibility");
const cities_1 = __importDefault(require("./routes/cities"));
const account_1 = __importDefault(require("./routes/account"));
const auth_1 = require("./routes/auth");
const voices_1 = require("./routes/voices");
const vedic_1 = __importDefault(require("./routes/vedic"));
const vedic_v2_1 = __importDefault(require("./routes/vedic_v2"));
const admin_1 = __importDefault(require("./routes/admin"));
const internalPeopleScaling_1 = __importDefault(require("./routes/internalPeopleScaling"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const payments_1 = __importDefault(require("./routes/payments"));
const people_1 = __importDefault(require("./routes/people"));
const profile_1 = __importDefault(require("./routes/profile"));
const couples_1 = __importDefault(require("./routes/couples"));
const chat_1 = __importDefault(require("./routes/chat"));
const coupons_1 = __importDefault(require("./routes/coupons"));
const apiKeys_1 = require("./services/apiKeys");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
require("./services/jobHealthCheck"); // Auto-starts job health check service
const app = new hono_1.Hono();
// CORS middleware - restrict to known origins
const allowedOrigins = [
    'https://1-in-a-billion.app',
    'https://www.1-in-a-billion.app',
    ...(process.env.NODE_ENV !== 'production' ? [
        'http://localhost:8081', // Expo dev
        'http://localhost:19006', // Expo web dev
    ] : []),
];
app.use('*', (0, cors_1.cors)({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
}));
// Global error handler - must be first middleware
app.use('*', errorHandler_1.errorHandler);
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
app.use('*', rateLimiter_1.globalLimiter);
app.use('/api/auth/*', rateLimiter_1.authLimiter);
app.use('/api/jobs/v2/start', rateLimiter_1.llmLimiter);
app.use('/api/jobs/v2/:jobId', rateLimiter_1.jobPollingLimiter);
app.use('/api/jobs/v2/user/:userId/jobs', rateLimiter_1.jobPollingLimiter);
app.use('/api/payments/webhook', rateLimiter_1.webhookLimiter);
app.use('/api/admin/*', rateLimiter_1.adminLimiter);
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));
// Swiss Ephemeris health check
app.get('/health/ephemeris', async (c) => {
    const { swissEngine } = await Promise.resolve().then(() => __importStar(require('./services/swissEphemeris')));
    const result = await swissEngine.healthCheck();
    return c.json(result);
});
app.route('/api/reading', readings_1.readingsRouter);
app.route('/api/match', matches_1.matchesRouter);
app.route('/api/audio', audio_1.audioRouter);
app.route('/api/pdf', pdf_1.pdfRouter);
app.route('/api/jobs', jobs_1.default);
app.route('/api/dev', devDashboard_1.default);
app.route('/api/compatibility', compatibility_1.compatibilityRouter);
app.route('/api/cities', cities_1.default);
app.route('/api/account', account_1.default);
app.route('/api/auth', auth_1.authRouter);
app.route('/api/voices', voices_1.voicesRouter);
app.route('/api/vedic', vedic_1.default);
app.route('/api/vedic-v2', vedic_v2_1.default);
app.route('/api/admin', admin_1.default);
app.route('/api/internal/people-scaling', internalPeopleScaling_1.default);
app.route('/api/notifications', notifications_1.default);
app.route('/api/payments', payments_1.default);
app.route('/api/people', people_1.default);
app.route('/api/profile', profile_1.default);
app.route('/api/couples', couples_1.default);
app.route('/api/chat', chat_1.default);
app.route('/api/coupons', coupons_1.default);
// Start text worker in background (processes Supabase queue)
// No GPU needed - just calls DeepSeek API
if (process.env.ENABLE_TEXT_WORKER !== 'false') {
    Promise.resolve().then(() => __importStar(require('./workers/textWorker'))).then(({ TextWorker }) => {
        const worker = new TextWorker();
        worker.start();
        console.log('📝 Text worker started in background');
    }).catch(err => {
        console.warn('Text worker not started:', err.message);
    });
}
// Start watchdog in background (reclaims stale tasks + sends notifications)
if (process.env.ENABLE_TEXT_WORKER !== 'false') {
    Promise.resolve().then(() => __importStar(require('./workers/watchdogWorker'))).then(({ startWatchdog }) => {
        startWatchdog();
        console.log('👁️  Watchdog worker started in background');
    }).catch(err => {
        console.warn('Watchdog worker not started:', err.message);
    });
}
// NOTE: Song generation runs in the Fly `song-worker` process group.
// We intentionally do NOT run it in the API process to avoid double-claiming tasks.
// Preload API keys from Supabase at startup
(0, apiKeys_1.preloadApiKeys)().catch(err => {
    console.warn('⚠️ API key preload failed (will use env fallback):', err.message);
});
(0, node_server_1.serve)({
    fetch: app.fetch,
    port: env_1.env.PORT,
});
console.log(`🚀 Backend running on http://localhost:${env_1.env.PORT}`);
//# sourceMappingURL=server.js.map