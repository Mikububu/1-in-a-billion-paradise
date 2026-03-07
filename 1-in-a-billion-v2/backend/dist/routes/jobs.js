"use strict";
/**
 * JOB ROUTES - 5-PART NUCLEAR APPROACH
 *
 * Nuclear Package:
 * - 5 parts (Portraits, Hunger, Abyss, Labyrinth, Mirror)
 * - Each part ~6000 words (max_tokens: 8192)
 * - Total ~30,000 words
 * - Progressive generation: TEXT → PDF → AUDIO per part
 *
 * Uses the new modular prompt system for Claude Desktop-quality output.
 */
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
const hono_1 = require("hono");
const jobQueueV2_1 = require("../services/jobQueueV2");
const supabaseClient_1 = require("../services/supabaseClient");
const env_1 = require("../config/env");
const axios_1 = __importDefault(require("axios"));
const archiver_1 = __importDefault(require("archiver"));
const node_stream_1 = require("node:stream");
const requireAuth_1 = require("../middleware/requireAuth");
const sanitizeInput_1 = require("../utils/sanitizeInput");
const logger_1 = require("../utils/logger");
const router = new hono_1.Hono();
const DEBUG_LOG_PATH = process.env.DEBUG_LOG_PATH || `${process.cwd()}/.cursor/debug.log`;
function appendAgentDebug(location, message, data, hypothesisId) {
    if (process.env.ENABLE_AGENT_DEBUG_LOG !== '1')
        return;
    Promise.resolve().then(() => __importStar(require('node:fs'))).then(async (fs) => {
        await fs.promises.mkdir(`${process.cwd()}/.cursor`, { recursive: true });
        await fs.promises.appendFile(DEBUG_LOG_PATH, JSON.stringify({
            location,
            message,
            data,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId,
        }) + '\n');
    })
        .catch((err) => {
        logger_1.logger.warn('[debugLog] Failed to write debug log', { error: String(err) });
    });
}
function getBearerToken(c) {
    const auth = c.req.header('Authorization') || c.req.header('authorization');
    if (!auth)
        return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}
// REMOVED: Deprecated getAuthenticatedUserId and requireAuth functions.
// All endpoints now use jwtAuth middleware from ../middleware/requireAuth.
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:jobId', requireAuth_1.requireAuth, async (c) => {
    const userId = (0, requireAuth_1.getAuthUserId)(c);
    if (!userId)
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    const jobId = c.req.param('jobId');
    if (!jobId)
        return c.json({ success: false, error: 'Missing job ID' }, 400);
    try {
        // 1. Verify ownership
        const { data: job, error: fetchError } = await supabaseClient_1.supabase
            .from('jobs')
            .select('user_id')
            .eq('id', jobId)
            .single();
        if (fetchError || !job) {
            return c.json({ success: false, error: 'Job not found' }, 404);
        }
        if (job.user_id !== userId) {
            return c.json({ success: false, error: 'Unauthorized to delete this job' }, 403);
        }
        // 2. Delete tasks
        const { error: tasksError } = await supabaseClient_1.supabase
            .from('job_tasks')
            .delete()
            .eq('job_id', jobId);
        if (tasksError) {
            logger_1.logger.error('[DELETE JOB] Failed to delete tasks', { error: String(tasksError) });
            return c.json({ success: false, error: 'Failed to delete job tasks' }, 500);
        }
        // 3. Delete job
        const { error: jobError } = await supabaseClient_1.supabase
            .from('jobs')
            .delete()
            .eq('id', jobId);
        if (jobError) {
            logger_1.logger.error('[DELETE JOB] Failed to delete job', { error: String(jobError) });
            return c.json({ success: false, error: 'Failed to delete job' }, 500);
        }
        return c.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[DELETE JOB] Error', { error: String(err) });
        return c.json({ success: false, error: 'Internal server error' }, 500);
    }
});
// POST /api/jobs/v2/start - Create a new reading job
// ═══════════════════════════════════════════════════════════════════════════
router.post('/v2/start', requireAuth_1.requireAuth, async (c) => {
    try {
        const userId = c.get('userId');
        if (!userId) {
            return c.json({ success: false, error: 'Missing authentication' }, 401);
        }
        const body = await c.req.json();
        const { type = 'extended', systems, person1, person2, voiceId, promptLayerDirective, relationshipPreferenceScale, bundleComposition, relationshipContext, personalContext, useIncludedReading, purchaseTransactionId, language, } = body;
        if (!systems || !Array.isArray(systems) || systems.length === 0) {
            return c.json({ success: false, error: 'Missing systems array' }, 400);
        }
        if (!person1?.birthDate || !person1?.birthTime || !person1?.timezone) {
            return c.json({ success: false, error: 'Missing person1 birth data' }, 400);
        }
        // ── Monthly Quota Check ──────────────────────────────────────────────
        const { canStartReading, getMonthlyQuotaStatus, hasUnlimitedReadings } = await Promise.resolve().then(() => __importStar(require('../services/subscriptionService')));
        const unlimited = await hasUnlimitedReadings(userId);
        const isSynastry = type === 'synastry';
        if (useIncludedReading) {
            const eligible = await canStartReading(userId, isSynastry);
            if (!eligible) {
                const quota = await getMonthlyQuotaStatus(userId);
                const msg = quota
                    ? `Monthly reading limit reached (${quota.used}/${quota.monthlyLimit} used this period). ${isSynastry ? 'Synastry requires 3 reading slots.' : ''}`
                    : 'Not eligible for reading (no active subscription)';
                return c.json({
                    success: false,
                    error: msg,
                    quotaExceeded: true,
                    quota: quota ? { used: quota.used, limit: quota.monthlyLimit, remaining: quota.remaining } : undefined,
                }, 403);
            }
        }
        // ── Payment Gate: reject unpaid requests ────────────────────────────
        // If not using a subscription reading, a purchase transaction must be provided.
        // The actual payment was already processed by Apple via RevenueCat on the client.
        if (!useIncludedReading && !unlimited && !purchaseTransactionId) {
            logger_1.logger.warn(`Job rejected: no payment proof`, { userId, type });
            return c.json({
                success: false,
                error: 'Payment required. Please purchase this reading before generating.',
                paymentRequired: true,
            }, 402);
        }
        if (purchaseTransactionId) {
            const txId = String(purchaseTransactionId).trim();
            if (!/^\d{6,25}$/.test(txId)) {
                logger_1.logger.warn(`Job rejected: invalid transaction ID format`, { userId, purchaseTransactionId });
                return c.json({
                    success: false,
                    error: 'Invalid purchase transaction. Please try again.',
                    paymentRequired: true,
                }, 402);
            }
            logger_1.logger.info(`IAP purchase accepted`, { userId, purchaseTransactionId: txId, type });
        }
        // Build job params (same shape the workers expect)
        const params = {
            type,
            systems,
            person1,
            promptLayerDirective: (0, sanitizeInput_1.sanitizeDirective)(promptLayerDirective),
            relationshipPreferenceScale: Math.min(10, Math.max(1, Math.round(relationshipPreferenceScale || 5))),
        };
        if (person2)
            params.person2 = person2;
        if (voiceId)
            params.voiceId = voiceId;
        if (bundleComposition)
            params.bundleComposition = bundleComposition;
        if (language)
            params.outputLanguage = language;
        // Sanitize user-provided text fields before they reach the LLM
        if (relationshipContext)
            params.relationshipContext = (0, sanitizeInput_1.sanitizeContext)(relationshipContext);
        if (personalContext)
            params.personalContext = (0, sanitizeInput_1.sanitizeContext)(personalContext);
        if (useIncludedReading)
            params.useIncludedReading = true;
        // Create job (DB trigger auto-creates tasks)
        const jobId = await jobQueueV2_1.jobQueueV2.createJob({
            userId,
            type: type,
            params,
        });
        // Log reading against monthly quota
        if (useIncludedReading) {
            const quota = await getMonthlyQuotaStatus(userId);
            logger_1.logger.info(`Reading counted`, { userId, type: isSynastry ? 'synastry(3)' : 'individual(1)', quotaUsed: quota?.used, quotaLimit: quota?.monthlyLimit });
        }
        logger_1.logger.info(`Job started`, { jobId, type, systems: systems.join(','), userId });
        return c.json({ success: true, jobId });
    }
    catch (error) {
        logger_1.logger.error('Failed to start job', { error: error?.message || String(error) });
        return c.json({ success: false, error: error?.message ?? 'Failed to start job' }, 500);
    }
});
// V2: Supabase-backed job read (RLS enforced).
// Requires authentication - uses user's token for RLS-safe queries.
const getJobHandler = async (c) => {
    const accessToken = getBearerToken(c);
    if (!accessToken) {
        return c.json({ success: false, error: 'Missing authorization token' }, 401);
    }
    const jobId = c.req.param('jobId');
    let job, error;
    // Authenticated - use user client with RLS
    const userClient = (0, supabaseClient_1.createSupabaseUserClientFromAccessToken)(accessToken);
    if (!userClient) {
        return c.json({ success: false, error: 'Supabase user client not configured' }, 500);
    }
    const result = await userClient
        .from('jobs')
        .select(`*, artifacts:job_artifacts(*)`)
        .eq('id', jobId)
        .single();
    job = result.data;
    error = result.error;
    if (error || !job) {
        return c.json({ success: false, error: 'Job not found' }, 404);
    }
    // Attach signed URLs for private Storage artifacts (service role).
    // Use Promise.all for parallel URL generation to avoid timeout with many artifacts
    const jobWithArtifacts = job;
    if (jobWithArtifacts.artifacts && Array.isArray(jobWithArtifacts.artifacts)) {
        await Promise.all(jobWithArtifacts.artifacts.map(async (artifact) => {
            if (!artifact.public_url && artifact.storage_path) {
                artifact.public_url = (await (0, supabaseClient_1.getSignedArtifactUrl)(artifact.storage_path)) || undefined;
            }
        }));
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD results.documents FROM ARTIFACTS (V2 jobs don't have results populated)
    // Frontend expects job.results.documents for chapter display
    // ═══════════════════════════════════════════════════════════════════════════
    if (jobWithArtifacts.artifacts && Array.isArray(jobWithArtifacts.artifacts) && jobWithArtifacts.artifacts.length > 0) {
        // Fetch tasks to get task_id → sequence mapping (for audio artifacts without docNum)
        const tasks = await jobQueueV2_1.jobQueueV2.getJobTasks(jobId);
        const taskIdToSequence = {};
        const taskIdToInput = {};
        for (const task of tasks) {
            taskIdToSequence[task.id] = task.sequence;
            taskIdToInput[task.id] = task.input || {};
        }
        // Group artifacts by docNum (derived from metadata OR task sequence)
        const artifactsByDoc = {};
        for (const artifact of jobWithArtifacts.artifacts) {
            // Try to get docNum from metadata first, then from task sequence
            let docNum = artifact.metadata?.docNum;
            // For audio artifacts, docNum is often missing - derive from task sequence
            if (typeof docNum !== 'number' && artifact.task_id) {
                const seq = taskIdToSequence[artifact.task_id];
                if (typeof seq === 'number') {
                    // Text tasks have sequence 0-15 → docNum 1-16
                    // Audio tasks have sequence 200-215 → docNum = sequence - 199
                    if (seq >= 200) {
                        docNum = seq - 199; // 200→1, 201→2, etc.
                    }
                    else if (seq >= 100) {
                        docNum = seq - 99; // PDF: 100→1, 101→2, etc.
                    }
                    else {
                        docNum = seq + 1; // Text: 0→1, 1→2, etc.
                    }
                }
            }
            if (typeof docNum !== 'number')
                continue;
            if (!artifactsByDoc[docNum]) {
                artifactsByDoc[docNum] = {};
            }
            if (artifact.artifact_type === 'text') {
                artifactsByDoc[docNum].text = artifact;
            }
            else if (artifact.artifact_type === 'pdf') {
                artifactsByDoc[docNum].pdf = artifact;
            }
            else if (artifact.artifact_type === 'audio' || artifact.artifact_type === 'audio_mp3') {
                artifactsByDoc[docNum].audio = artifact;
            }
            else if (artifact.artifact_type === 'audio_song') {
                artifactsByDoc[docNum].song = artifact;
            }
        }
        // Build documents array sorted by docNum
        const documents = [];
        const docNums = Object.keys(artifactsByDoc).map(Number).sort((a, b) => a - b);
        for (const docNum of docNums) {
            const artifacts = artifactsByDoc[docNum];
            const textMeta = artifacts.text?.metadata || {};
            const audioMeta = artifacts.audio?.metadata || {};
            const pdfMeta = artifacts.pdf?.metadata || {};
            const songMeta = artifacts.song?.metadata || {};
            documents.push({
                id: `doc_${docNum}`,
                title: textMeta.title || audioMeta.title || pdfMeta.title || `Chapter ${docNum}`,
                system: textMeta.system || audioMeta.system || pdfMeta.system || 'unknown',
                docType: textMeta.docType || audioMeta.docType || pdfMeta.docType || 'unknown',
                docNum,
                // Include URLs if available (signed URLs already generated above)
                audioUrl: artifacts.audio?.public_url,
                pdfUrl: artifacts.pdf?.public_url,
                songUrl: artifacts.song?.public_url, // Personalized song URL
                // Don't include full text in response (too large) - can be fetched separately
            });
        }
        // Set results.documents
        if (!jobWithArtifacts.results) {
            jobWithArtifacts.results = {};
        }
        jobWithArtifacts.results.documents = documents;
        logger_1.logger.info(`Built ${documents.length} documents from ${jobWithArtifacts.artifacts.length} artifacts`);
    }
    return c.json({ success: true, job });
};
// Legacy endpoint (for frontend compatibility)
router.get('/:jobId', getJobHandler);
// V2 endpoint
router.get('/v2/:jobId', getJobHandler);
// Export a ZIP for a subset of docs within a job (PDF + narration audio + song audio)
// Requires Authorization: Bearer <supabase access token>
router.get('/v2/:jobId/export', async (c) => {
    const accessToken = getBearerToken(c);
    if (!accessToken) {
        return c.json({ success: false, error: 'Missing authorization token' }, 401);
    }
    const jobId = c.req.param('jobId');
    const docsParam = (c.req.query('docs') || '').trim(); // e.g. "1,2,3,4,5"
    const includeParam = (c.req.query('include') || 'pdf,audio,song').trim(); // default: all media
    const docs = Array.from(new Set(docsParam
        .split(',')
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 16))).sort((a, b) => a - b);
    if (docs.length === 0) {
        return c.json({ success: false, error: 'Missing docs query param (e.g. ?docs=1,2,3,4,5)' }, 400);
    }
    const includeSet = new Set(includeParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean));
    const includePdf = includeSet.has('pdf');
    const includeAudio = includeSet.has('audio');
    const includeSong = includeSet.has('song');
    // Verify job belongs to the authenticated user (RLS)
    const userClient = (0, supabaseClient_1.createSupabaseUserClientFromAccessToken)(accessToken);
    if (!userClient)
        return c.json({ success: false, error: 'Supabase user client not configured' }, 500);
    const { data: jobRow, error: jobErr } = await userClient
        .from('jobs')
        .select('id,user_id,status,type,created_at,params')
        .eq('id', jobId)
        .single();
    if (jobErr || !jobRow) {
        return c.json({ success: false, error: 'Job not found' }, 404);
    }
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    // Use service role for storage signed URLs (RLS-safe, avoids failures)
    const serviceClient = supabaseClient_1.supabase;
    const { data: artifacts, error: artErr } = await serviceClient
        .from('job_artifacts')
        .select('*')
        .eq('job_id', jobId)
        .in('artifact_type', [
        ...(includePdf ? ['pdf'] : []),
        ...(includeAudio ? ['audio_mp3', 'audio_m4a'] : []),
        ...(includeSong ? ['audio_song'] : []),
    ])
        .order('created_at', { ascending: true });
    if (artErr) {
        return c.json({ success: false, error: `Failed to fetch artifacts: ${artErr.message}` }, 500);
    }
    // Map task_id → sequence to derive docNum when metadata is missing (same logic as /v2/:jobId handler)
    const tasks = await jobQueueV2_1.jobQueueV2.getJobTasks(jobId);
    const taskIdToSequence = {};
    for (const t of tasks)
        taskIdToSequence[t.id] = t.sequence;
    const docKey = (docNum) => (docs.includes(docNum) ? docNum : null);
    const byDoc = {};
    for (const a of artifacts || []) {
        let docNum = a.metadata?.docNum;
        if (typeof docNum !== 'number' && a.task_id) {
            const seq = taskIdToSequence[a.task_id];
            if (typeof seq === 'number') {
                if (seq >= 300)
                    docNum = seq - 299; // songs
                else if (seq >= 200)
                    docNum = seq - 199; // audio
                else if (seq >= 100)
                    docNum = seq - 99; // pdf
                else
                    docNum = seq + 1; // text
            }
        }
        if (typeof docNum !== 'number')
            continue;
        if (!docKey(docNum))
            continue;
        if (!byDoc[docNum])
            byDoc[docNum] = {};
        if (a.artifact_type === 'pdf')
            byDoc[docNum].pdf = a;
        if (a.artifact_type === 'audio_song')
            byDoc[docNum].song = a;
        if (a.artifact_type === 'audio_mp3' || a.artifact_type === 'audio_m4a')
            byDoc[docNum].audio = a;
        byDoc[docNum].meta = byDoc[docNum].meta || a.metadata || {};
    }
    // Strict readiness: if requested include types are missing for any doc, return 409
    const missing = [];
    for (const d of docs) {
        const row = byDoc[d] || {};
        const m = [];
        if (includePdf && !row.pdf?.storage_path)
            m.push('pdf');
        if (includeAudio && !row.audio?.storage_path)
            m.push('audio');
        if (includeSong && !row.song?.storage_path)
            m.push('song');
        if (m.length)
            missing.push({ docNum: d, missing: m });
    }
    if (missing.length) {
        return c.json({ success: false, error: 'Artifacts not ready', missing }, 409);
    }
    const safe = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
    const baseName = safe(String(jobRow.params?.person1?.name && jobRow.params?.person2?.name
        ? `${jobRow.params?.person1?.name}_${jobRow.params?.person2?.name}`
        : jobRow.params?.person?.name || 'reading'));
    const zipName = `${baseName}_${jobId.slice(0, 8)}.zip`;
    const out = new node_stream_1.PassThrough();
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
        logger_1.logger.error('ZIP archive error', { error: String(err) });
        out.destroy(err);
    });
    archive.pipe(out);
    // Build and append each file stream
    for (const d of docs) {
        const row = byDoc[d];
        const meta = row.meta || {};
        const system = safe(meta.system || `doc_${d}`);
        const docType = safe(meta.docType || '');
        const prefix = `${String(d).padStart(2, '0')}_${system}${docType ? `_${docType}` : ''}`;
        const add = async (storagePath, name) => {
            const signed = await (0, supabaseClient_1.getSignedArtifactUrl)(storagePath, 60 * 60);
            if (!signed)
                throw new Error(`Failed to sign ${storagePath}`);
            const resp = await axios_1.default.get(signed, { responseType: 'stream' });
            archive.append(resp.data, { name });
        };
        if (includePdf)
            await add(row.pdf.storage_path, `${prefix}.pdf`);
        if (includeAudio) {
            const ext = row.audio?.artifact_type === 'audio_m4a' ? 'm4a' : 'mp3';
            await add(row.audio.storage_path, `${prefix}_narration.${ext}`);
        }
        if (includeSong)
            await add(row.song.storage_path, `${prefix}_song.mp3`);
    }
    archive.finalize().catch((err) => {
        logger_1.logger.error('[ZIP] archive.finalize() failed', { error: String(err) });
    });
    const headers = new Headers();
    headers.set('content-type', 'application/zip');
    headers.set('content-disposition', `attachment; filename="${zipName}"`);
    headers.set('cache-control', 'no-store');
    // Convert Node stream to Web stream for Response
    const body = node_stream_1.Readable.toWeb(out);
    return new Response(body, { status: 200, headers });
});
// DEBUG: Get all tasks for a job (requires JWT auth)
router.get('/v2/:jobId/tasks', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    const tasks = await jobQueueV2_1.jobQueueV2.getJobTasks(jobId);
    return c.json({
        success: true,
        totalTasks: tasks.length,
        tasks: tasks.map(t => ({
            id: t.id,
            sequence: t.sequence,
            task_type: t.task_type,
            status: t.status,
            docNum: t.input?.docNum,
            docType: t.input?.docType,
            system: t.input?.system,
            title: t.input?.title,
            error: t.error,
            attempts: t.attempts,
        })),
    });
});
// DEBUG: Delete a job (requires JWT auth)
router.delete('/v2/:jobId', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    if (!env_1.env.SUPABASE_URL) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!supabaseClient_1.supabase) {
        return c.json({ success: false, error: 'Supabase service role key not configured' }, 500);
    }
    const supabase = supabaseClient_1.supabase;
    // Only allow users to delete their own jobs
    const authUserId = c.get('userId');
    const { data: job, error: fetchErr } = await supabase
        .from('jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();
    if (fetchErr || !job) {
        return c.json({ success: false, error: 'Job not found' }, 404);
    }
    if (job.user_id !== authUserId) {
        return c.json({ success: false, error: 'Not authorized to delete this job' }, 403);
    }
    // Delete job (cascades to tasks and artifacts)
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, deleted: jobId });
});
// DEBUG: List all jobs for a user (requires JWT auth, only own jobs)
router.get('/v2/user/:userId/jobs', requireAuth_1.requireAuth, async (c) => {
    const authUserId = c.get('userId');
    const userId = c.req.param('userId');
    // Users can only list their own jobs
    if (authUserId !== userId) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    const jobs = await jobQueueV2_1.jobQueueV2.getUserJobs(userId, limit);
    // Fetch tasks for each job to show detailed status
    const jobsWithDetails = await Promise.all(jobs.map(async (j) => {
        const tasks = await jobQueueV2_1.jobQueueV2.getJobTasks(j.id);
        const tasksByStatus = {
            pending: tasks.filter(t => t.status === 'pending').length,
            processing: tasks.filter(t => t.status === 'processing').length,
            complete: tasks.filter(t => t.status === 'complete').length,
            failed: tasks.filter(t => t.status === 'failed').length,
        };
        return {
            id: j.id,
            status: j.status,
            type: j.type,
            createdAt: j.created_at,
            completedAt: j.completed_at,
            percent: j.progress?.percent,
            tasksComplete: j.progress?.tasksComplete,
            tasksTotal: j.progress?.tasksTotal,
            taskBreakdown: tasksByStatus,
            systems: j.params?.systems || [],
            // CRITICAL: Include person IDs AND names so frontend can link jobs to people cards
            params: {
                person1: j.params?.person1 ? {
                    id: j.params.person1.id,
                    name: j.params.person1.name
                } : undefined,
                person2: j.params?.person2 ? {
                    id: j.params.person2.id,
                    name: j.params.person2.name
                } : undefined,
                systems: j.params?.systems || [],
            },
        };
    }));
    return c.json({
        success: true,
        totalJobs: jobs.length,
        jobs: jobsWithDetails,
    });
});
// Audio streaming endpoint: /api/jobs/v2/:jobId/audio/:docNum
// Returns a redirect to the signed URL for the audio artifact
router.get('/v2/:jobId/audio/:docNum', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    const docNum = parseInt(c.req.param('docNum'), 10);
    const rangeHeader = c.req.header('range') || c.req.header('Range') || null;
    appendAgentDebug('jobs.ts:465', 'Audio endpoint called', { jobId: jobId.substring(0, 8), docNum }, 'C');
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!Number.isFinite(docNum) || docNum < 1) {
        return c.json({ success: false, error: 'Invalid docNum' }, 400);
    }
    try {
        const { jobQueueV2 } = await Promise.resolve().then(() => __importStar(require('../services/jobQueueV2')));
        const job = await jobQueueV2.getJob(jobId);
        if (!job) {
            return c.json({ success: false, error: 'Job not found' }, 404);
        }
        // Verify the authenticated user owns this job
        const authUserId = c.get('userId');
        if (job.user_id !== authUserId) {
            return c.json({ success: false, error: 'Not authorized to access this job' }, 403);
        }
        // Get all artifacts for this job
        const supabase = supabaseClient_1.supabase;
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .in('artifact_type', ['audio_mp3', 'audio_m4a'])
            .order('created_at', { ascending: true });
        if (error) {
            logger_1.logger.error('Error fetching audio artifacts', { error: JSON.stringify(error) });
            return c.json({ success: false, error: `Failed to fetch audio artifacts: ${error.message || JSON.stringify(error)}` }, 500);
        }
        if (!artifacts || artifacts.length === 0) {
            return c.json({ success: false, error: 'No audio artifacts found' }, 404);
        }
        // Find artifact matching docNum (from metadata or derive from task sequence)
        let audioArtifact = artifacts.find((a) => a.metadata?.docNum === docNum);
        appendAgentDebug('jobs.ts:507', 'Audio artifact search', {
            jobId: jobId.substring(0, 8),
            requestedDocNum: docNum,
            totalArtifacts: artifacts.length,
            artifactMetadata: artifacts.map((a) => ({
                docNum: a.metadata?.docNum,
                system: a.metadata?.system,
                docType: a.metadata?.docType,
            })),
            foundMatch: !!audioArtifact,
            matchedDocNum: audioArtifact?.metadata?.docNum,
        }, 'C');
        // If not found by metadata, try to match by task sequence
        if (!audioArtifact) {
            const tasks = await jobQueueV2.getJobTasks(jobId);
            const taskIdToSequence = {};
            for (const task of tasks) {
                taskIdToSequence[task.id] = task.sequence;
            }
            // Audio tasks typically have sequence 200+ (docNum = sequence - 199)
            for (const artifact of artifacts) {
                if (artifact.task_id) {
                    const seq = taskIdToSequence[artifact.task_id];
                    if (typeof seq === 'number' && seq >= 200) {
                        const artifactDocNum = seq - 199;
                        if (artifactDocNum === docNum) {
                            audioArtifact = artifact;
                            break;
                        }
                    }
                }
            }
        }
        // REMOVED: Dangerous fallbacks that served wrong audio!
        // Previously: if only one artifact, use it for any docNum (WRONG)
        // Previously: if docNum=1 not found, use first artifact (WRONG)
        // Now: We ONLY serve audio if we find an exact match by docNum
        if (!audioArtifact || !audioArtifact.storage_path) {
            logger_1.logger.error(`Audio artifact not found for job ${jobId}, docNum ${docNum}`, { availableArtifacts: artifacts.length });
            return c.json({ success: false, error: `Audio artifact not found for docNum ${docNum}` }, 404);
        }
        logger_1.logger.info(`Found audio artifact for docNum ${docNum}: ${audioArtifact.storage_path}`);
        // Get signed URL (valid for 1 hour)
        const signedUrl = await (0, supabaseClient_1.getSignedArtifactUrl)(audioArtifact.storage_path, 3600);
        if (!signedUrl) {
            return c.json({ success: false, error: 'Failed to generate signed URL' }, 500);
        }
        // Stream the audio bytes directly (iOS AVPlayer has issues with redirects).
        // IMPORTANT: Support HTTP Range requests so seeking works.
        logger_1.logger.info(`Streaming audio from signed URL`, { rangeHeader: rangeHeader || undefined });
        const audioResponse = await fetch(signedUrl, {
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
        });
        if (!audioResponse.ok) {
            logger_1.logger.error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
            return c.json({ success: false, error: 'Failed to fetch audio from storage' }, 500);
        }
        const headers = new Headers();
        const passthroughKeys = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'];
        for (const k of passthroughKeys) {
            const v = audioResponse.headers.get(k);
            if (v)
                headers.set(k, v);
        }
        headers.set('accept-ranges', 'bytes');
        headers.set('cache-control', 'public, max-age=3600');
        // Return streaming response with upstream status (200 or 206)
        return new Response(audioResponse.body, { status: audioResponse.status, headers });
    }
    catch (error) {
        logger_1.logger.error('Error in audio endpoint', { error: error?.message || String(error) });
        return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
    }
});
// Song download endpoint: /api/jobs/v2/:jobId/song/:docNum
// Returns a redirect to the signed URL for the song artifact
router.get('/v2/:jobId/song/:docNum', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    const docNum = parseInt(c.req.param('docNum'), 10);
    const rangeHeader = c.req.header('range') || c.req.header('Range') || null;
    appendAgentDebug('jobs.ts:580', 'Song endpoint called', { jobId: jobId.substring(0, 8), docNum }, 'D');
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!Number.isFinite(docNum) || docNum < 1) {
        return c.json({ success: false, error: 'Invalid docNum' }, 400);
    }
    try {
        const { jobQueueV2 } = await Promise.resolve().then(() => __importStar(require('../services/jobQueueV2')));
        const job = await jobQueueV2.getJob(jobId);
        if (!job) {
            return c.json({ success: false, error: 'Job not found' }, 404);
        }
        // Verify the authenticated user owns this job
        const authUserId = c.get('userId');
        if (job.user_id !== authUserId) {
            return c.json({ success: false, error: 'Not authorized to access this job' }, 403);
        }
        // Get all song artifacts for this job
        const supabase = supabaseClient_1.supabase;
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .eq('artifact_type', 'audio_song')
            .order('created_at', { ascending: true });
        if (error) {
            logger_1.logger.error('Error fetching song artifacts', { error: String(error) });
            return c.json({ success: false, error: 'Failed to fetch song artifacts' }, 500);
        }
        if (!artifacts || artifacts.length === 0) {
            return c.json({ success: false, error: 'No song artifacts found' }, 404);
        }
        // Find artifact matching docNum exactly (from metadata or derive from task sequence)
        let songArtifact = artifacts.find((a) => a.metadata?.docNum === docNum);
        // If not found by metadata, try to match by task sequence
        if (!songArtifact) {
            const tasks = await jobQueueV2.getJobTasks(jobId);
            const taskIdToSequence = {};
            for (const task of tasks) {
                taskIdToSequence[task.id] = task.sequence;
            }
            // Song tasks typically have sequence 300+ (docNum = sequence - 299)
            for (const artifact of artifacts) {
                if (artifact.task_id) {
                    const seq = taskIdToSequence[artifact.task_id];
                    if (typeof seq === 'number' && seq >= 300) {
                        const artifactDocNum = seq - 299;
                        if (artifactDocNum === docNum) {
                            songArtifact = artifact;
                            break;
                        }
                    }
                }
            }
        }
        // NO FALLBACKS - Only return exact matches
        if (!songArtifact || !songArtifact.storage_path) {
            logger_1.logger.error(`Song artifact not found for job ${jobId}, docNum ${docNum}`, { availableArtifacts: artifacts.length });
            return c.json({ success: false, error: `Song artifact not found for docNum ${docNum}` }, 404);
        }
        logger_1.logger.info(`Found song artifact for docNum ${docNum}: ${songArtifact.storage_path}`);
        // Get the URL to fetch from (prefer public, fallback to signed)
        let fetchUrl = songArtifact.public_url;
        if (!fetchUrl) {
            fetchUrl = await (0, supabaseClient_1.getSignedArtifactUrl)(songArtifact.storage_path, 3600);
        }
        if (!fetchUrl) {
            return c.json({ success: false, error: 'Failed to generate URL' }, 500);
        }
        // Stream the song bytes directly (iOS AVPlayer has issues with redirects).
        // IMPORTANT: Support HTTP Range requests so seeking works.
        logger_1.logger.info(`Streaming song from signed URL`, { rangeHeader: rangeHeader || undefined });
        const songResponse = await fetch(fetchUrl, {
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
        });
        if (!songResponse.ok) {
            logger_1.logger.error(`Failed to fetch song: ${songResponse.status} ${songResponse.statusText}`);
            return c.json({ success: false, error: 'Failed to fetch song from storage' }, 500);
        }
        const headers = new Headers();
        const passthroughKeys = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'];
        for (const k of passthroughKeys) {
            const v = songResponse.headers.get(k);
            if (v)
                headers.set(k, v);
        }
        headers.set('accept-ranges', 'bytes');
        headers.set('cache-control', 'public, max-age=3600');
        // Return streaming response with upstream status (200 or 206)
        return new Response(songResponse.body, { status: songResponse.status, headers });
    }
    catch (error) {
        logger_1.logger.error('Error in song endpoint', { error: error?.message || String(error) });
        return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
    }
});
// Song metadata endpoint: /api/jobs/v2/:jobId/song/:docNum/metadata
// Returns song title and lyrics (no audio)
router.get('/v2/:jobId/song/:docNum/metadata', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    const docNum = parseInt(c.req.param('docNum'), 10);
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!Number.isFinite(docNum) || docNum < 1) {
        return c.json({ success: false, error: 'Invalid docNum' }, 400);
    }
    try {
        const { jobQueueV2 } = await Promise.resolve().then(() => __importStar(require('../services/jobQueueV2')));
        const job = await jobQueueV2.getJob(jobId);
        if (!job) {
            return c.json({ success: false, error: 'Job not found' }, 404);
        }
        // Verify the authenticated user owns this job
        const authUserId = c.get('userId');
        if (job.user_id !== authUserId) {
            return c.json({ success: false, error: 'Not authorized to access this job' }, 403);
        }
        // Get song artifact metadata for this job
        const supabase = supabaseClient_1.supabase;
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .eq('artifact_type', 'audio_song')
            .order('created_at', { ascending: true });
        if (error) {
            logger_1.logger.error('Error fetching song artifacts', { error: String(error) });
            return c.json({ success: false, error: 'Failed to fetch song artifacts' }, 500);
        }
        if (!artifacts || artifacts.length === 0) {
            return c.json({ success: false, error: 'No song artifacts found' }, 404);
        }
        // Find artifact matching docNum
        let songArtifact = artifacts.find((a) => a.metadata?.docNum === docNum);
        // If not found by metadata, try to match by task sequence
        if (!songArtifact) {
            const tasks = await jobQueueV2.getJobTasks(jobId);
            const taskIdToSequence = {};
            for (const task of tasks) {
                taskIdToSequence[task.id] = task.sequence;
            }
            for (const artifact of artifacts) {
                if (artifact.task_id) {
                    const seq = taskIdToSequence[artifact.task_id];
                    if (typeof seq === 'number' && seq >= 300) {
                        const artifactDocNum = seq - 299;
                        if (artifactDocNum === docNum) {
                            songArtifact = artifact;
                            break;
                        }
                    }
                }
            }
        }
        if (!songArtifact) {
            return c.json({ success: false, error: `Song metadata not found for docNum ${docNum}` }, 404);
        }
        // Return metadata including lyrics
        return c.json({
            success: true,
            docNum,
            songTitle: songArtifact.metadata?.songTitle || null,
            lyrics: songArtifact.metadata?.lyrics || null,
            system: songArtifact.metadata?.system || null,
            docType: songArtifact.metadata?.docType || null,
        });
    }
    catch (error) {
        logger_1.logger.error('Error in song metadata endpoint', { error: error?.message || String(error) });
        return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
    }
});
// PDF download endpoint: /api/jobs/v2/:jobId/pdf/:docNum
// Returns the PDF artifact as application/pdf
router.get('/v2/:jobId/pdf/:docNum', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    const docNum = parseInt(c.req.param('docNum'), 10);
    if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!Number.isFinite(docNum) || docNum < 1) {
        return c.json({ success: false, error: 'Invalid docNum' }, 400);
    }
    try {
        const { jobQueueV2 } = await Promise.resolve().then(() => __importStar(require('../services/jobQueueV2')));
        const job = await jobQueueV2.getJob(jobId);
        if (!job) {
            return c.json({ success: false, error: 'Job not found' }, 404);
        }
        // Verify the authenticated user owns this job
        const authUserId = c.get('userId');
        if (job.user_id !== authUserId) {
            return c.json({ success: false, error: 'Not authorized to access this job' }, 403);
        }
        // Get all PDF artifacts for this job
        const supabase = supabaseClient_1.supabase;
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .eq('artifact_type', 'pdf')
            .order('created_at', { ascending: true });
        if (error) {
            logger_1.logger.error('Error fetching PDF artifacts', { error: String(error) });
            return c.json({ success: false, error: 'Failed to fetch PDF artifacts' }, 500);
        }
        if (!artifacts || artifacts.length === 0) {
            return c.json({ success: false, error: 'No PDF artifacts found' }, 404);
        }
        // Find artifact matching docNum exactly (from metadata or derive from task sequence)
        let pdfArtifact = artifacts.find((a) => a.metadata?.docNum === docNum);
        // If not found by metadata, try to match by task sequence
        if (!pdfArtifact) {
            const tasks = await jobQueueV2.getJobTasks(jobId);
            const taskIdToSequence = {};
            for (const task of tasks) {
                taskIdToSequence[task.id] = task.sequence;
            }
            // PDF tasks typically have sequence 100+ (docNum = sequence - 99)
            for (const artifact of artifacts) {
                if (artifact.task_id) {
                    const seq = taskIdToSequence[artifact.task_id];
                    if (typeof seq === 'number' && seq >= 100) {
                        const artifactDocNum = seq - 99;
                        if (artifactDocNum === docNum) {
                            pdfArtifact = artifact;
                            break;
                        }
                    }
                }
            }
        }
        if (!pdfArtifact || !pdfArtifact.storage_path) {
            logger_1.logger.error(`PDF artifact not found for job ${jobId}, docNum ${docNum}`, { availableArtifacts: artifacts.length });
            return c.json({ success: false, error: `PDF artifact not found for docNum ${docNum}` }, 404);
        }
        logger_1.logger.info(`Found PDF artifact for docNum ${docNum}: ${pdfArtifact.storage_path}`);
        // Get the URL to fetch from (prefer public, fallback to signed)
        let fetchUrl = pdfArtifact.public_url;
        if (!fetchUrl) {
            fetchUrl = await (0, supabaseClient_1.getSignedArtifactUrl)(pdfArtifact.storage_path, 3600);
        }
        if (!fetchUrl) {
            return c.json({ success: false, error: 'Failed to generate URL' }, 500);
        }
        // Stream the PDF bytes directly
        logger_1.logger.info('Streaming PDF from signed URL');
        const pdfResponse = await fetch(fetchUrl);
        if (!pdfResponse.ok) {
            logger_1.logger.error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
            return c.json({ success: false, error: 'Failed to fetch PDF from storage' }, 500);
        }
        const headers = new Headers();
        headers.set('content-type', 'application/pdf');
        const contentLength = pdfResponse.headers.get('content-length');
        if (contentLength)
            headers.set('content-length', contentLength);
        headers.set('cache-control', 'public, max-age=3600');
        // Return PDF stream
        return new Response(pdfResponse.body, { status: 200, headers });
    }
    catch (error) {
        logger_1.logger.error('Error in PDF endpoint', { error: error?.message || String(error) });
        return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
    }
});
// DEBUG: Reset stuck tasks (requires JWT auth)
router.post('/v2/:jobId/reset-stuck', requireAuth_1.requireAuth, async (c) => {
    const jobId = c.req.param('jobId');
    if (!env_1.env.SUPABASE_URL) {
        return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }
    if (!supabaseClient_1.supabase) {
        return c.json({ success: false, error: 'Supabase service role key not configured' }, 500);
    }
    const supabase = supabaseClient_1.supabase;
    // Verify the user owns this job before resetting
    const authUserId = c.get('userId');
    const { data: jobRow, error: fetchErr } = await supabase
        .from('jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();
    if (fetchErr || !jobRow) {
        return c.json({ success: false, error: 'Job not found' }, 404);
    }
    if (jobRow.user_id !== authUserId) {
        return c.json({ success: false, error: 'Not authorized to reset this job' }, 403);
    }
    // Reset any tasks stuck in claimed/processing status (worker died)
    const { data, error } = await supabase
        .from('job_tasks')
        .update({
        status: 'pending',
        worker_id: null,
        claimed_at: null,
        started_at: null,
        last_heartbeat: null,
    })
        .eq('job_id', jobId)
        .in('status', ['claimed', 'processing'])
        .select();
    if (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({
        success: true,
        resetCount: data?.length || 0,
        resetTasks: data?.map((t) => ({ id: t.id, sequence: t.sequence, task_type: t.task_type })),
    });
});
exports.default = router;
//# sourceMappingURL=jobs.js.map