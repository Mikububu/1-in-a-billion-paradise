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

import { Hono } from 'hono';
import { jobQueueV2 } from '../services/jobQueueV2';
import { createSupabaseUserClientFromAccessToken, getSignedArtifactUrl, supabase as supabaseService } from '../services/supabaseClient';
import { env } from '../config/env';
import axios from 'axios';
import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';
import { requireAuth as jwtAuth, getAuthUserId } from '../middleware/requireAuth';
import { sanitizeDirective, sanitizeContext } from '../utils/sanitizeInput';
import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();
const DEBUG_LOG_PATH = process.env.DEBUG_LOG_PATH || `${process.cwd()}/.cursor/debug.log`;

function appendAgentDebug(location: string, message: string, data: Record<string, any>, hypothesisId: string): void {
  if (process.env.ENABLE_AGENT_DEBUG_LOG !== '1') return;
  import('node:fs')
    .then(async (fs) => {
      await fs.promises.mkdir(`${process.cwd()}/.cursor`, { recursive: true });
      await fs.promises.appendFile(
        DEBUG_LOG_PATH,
        JSON.stringify({
          location,
          message,
          data,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId,
        }) + '\n'
      );
    })
    .catch((err) => {
      console.warn('[debugLog] Failed to write debug log:', err);
    });
}

function getBearerToken(c: any): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// REMOVED: Deprecated getAuthenticatedUserId and requireAuth functions.
// All endpoints now use jwtAuth middleware from ../middleware/requireAuth.

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/jobs/v2/start — Create a new reading job
// ═══════════════════════════════════════════════════════════════════════════
router.post('/v2/start', jwtAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ success: false, error: 'Missing authentication' }, 401);
    }

    const body = await c.req.json();
    const {
      type = 'extended',
      systems,
      person1,
      person2,
      voiceId,
      promptLayerDirective,
      relationshipPreferenceScale,
      bundleComposition,
      relationshipContext,
      personalContext,
      useIncludedReading,
    } = body;

    if (!systems || !Array.isArray(systems) || systems.length === 0) {
      return c.json({ success: false, error: 'Missing systems array' }, 400);
    }
    if (!person1?.birthDate || !person1?.birthTime || !person1?.timezone) {
      return c.json({ success: false, error: 'Missing person1 birth data' }, 400);
    }

    // ── Monthly Quota Check ──────────────────────────────────────────────
    const { canStartReading, getMonthlyQuotaStatus, hasUnlimitedReadings } = await import('../services/subscriptionService');
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

    // Build job params (same shape the workers expect)
    const params: any = {
      type,
      systems,
      person1,
      promptLayerDirective: sanitizeDirective(promptLayerDirective),
      relationshipPreferenceScale: Math.min(10, Math.max(1, Math.round(relationshipPreferenceScale || 5))),
    };
    if (person2) params.person2 = person2;
    if (voiceId) params.voiceId = voiceId;
    if (bundleComposition) params.bundleComposition = bundleComposition;
    // Sanitize user-provided text fields before they reach the LLM
    if (relationshipContext) params.relationshipContext = sanitizeContext(relationshipContext);
    if (personalContext) params.personalContext = sanitizeContext(personalContext);
    if (useIncludedReading) params.useIncludedReading = true;

    // Create job (DB trigger auto-creates tasks)
    const jobId = await jobQueueV2.createJob({
      userId,
      type: type as any,
      params,
    });

    // Log reading against monthly quota
    if (useIncludedReading) {
      const { markIncludedReadingUsed } = await import('../services/subscriptionService');
      const system = systems[0] || 'unknown';
      await markIncludedReadingUsed(userId, system, jobId);
      const quota = await getMonthlyQuotaStatus(userId);
      console.log(`📊 Reading counted: user=${userId} type=${isSynastry ? 'synastry(3)' : 'individual(1)'} quota=${quota?.used}/${quota?.monthlyLimit}`);
    }

    console.log(`🚀 Job started: ${jobId} type=${type} systems=${systems.join(',')} user=${userId}`);
    return c.json({ success: true, jobId });
  } catch (error: any) {
    console.error('❌ Failed to start job:', error);
    return c.json({ success: false, error: error?.message ?? 'Failed to start job' }, 500);
  }
});

// V2: Supabase-backed job read (RLS enforced).
// Requires authentication — uses user's token for RLS-safe queries.
const getJobHandler = async (c: any) => {
  const accessToken = getBearerToken(c);
  if (!accessToken) {
    return c.json({ success: false, error: 'Missing authorization token' }, 401);
  }

  const jobId = c.req.param('jobId');
  let job, error;

  // Authenticated - use user client with RLS
  const userClient = createSupabaseUserClientFromAccessToken(accessToken);
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
  const jobWithArtifacts = job as any;
  if (jobWithArtifacts.artifacts && Array.isArray(jobWithArtifacts.artifacts)) {
    await Promise.all(
      jobWithArtifacts.artifacts.map(async (artifact: any) => {
        if (!artifact.public_url && artifact.storage_path) {
          artifact.public_url = (await getSignedArtifactUrl(artifact.storage_path)) || undefined;
        }
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD results.documents FROM ARTIFACTS (V2 jobs don't have results populated)
  // Frontend expects job.results.documents for chapter display
  // ═══════════════════════════════════════════════════════════════════════════
  if (jobWithArtifacts.artifacts && Array.isArray(jobWithArtifacts.artifacts) && jobWithArtifacts.artifacts.length > 0) {
    // Fetch tasks to get task_id → sequence mapping (for audio artifacts without docNum)
    const tasks = await jobQueueV2.getJobTasks(jobId);
    const taskIdToSequence: Record<string, number> = {};
    const taskIdToInput: Record<string, any> = {};
    for (const task of tasks) {
      taskIdToSequence[task.id] = task.sequence;
      taskIdToInput[task.id] = task.input || {};
    }

    // Group artifacts by docNum (derived from metadata OR task sequence)
    const artifactsByDoc: Record<number, { text?: any; pdf?: any; audio?: any }> = {};

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
          } else if (seq >= 100) {
            docNum = seq - 99; // PDF: 100→1, 101→2, etc.
          } else {
            docNum = seq + 1; // Text: 0→1, 1→2, etc.
          }
        }
      }

      if (typeof docNum !== 'number') continue;

      if (!artifactsByDoc[docNum]) {
        artifactsByDoc[docNum] = {} as any;
      }

      if (artifact.artifact_type === 'text') {
        (artifactsByDoc[docNum] as any).text = artifact;
      } else if (artifact.artifact_type === 'pdf') {
        (artifactsByDoc[docNum] as any).pdf = artifact;
      } else if (artifact.artifact_type === 'audio' || artifact.artifact_type === 'audio_mp3') {
        (artifactsByDoc[docNum] as any).audio = artifact;
      } else if (artifact.artifact_type === 'audio_song') {
        (artifactsByDoc[docNum] as any).song = artifact;
      }
    }

    // Build documents array sorted by docNum
    const documents: Array<{
      id: string;
      title: string;
      system: string;
      docType: string;
      docNum: number;
      text?: string;
      audioUrl?: string;
      pdfUrl?: string;
      songUrl?: string; // Personalized song for this document
    }> = [];

    const docNums = Object.keys(artifactsByDoc).map(Number).sort((a, b) => a - b);

    for (const docNum of docNums) {
      const artifacts = artifactsByDoc[docNum];
      const textMeta = (artifacts as any).text?.metadata || {};
      const audioMeta = (artifacts as any).audio?.metadata || {};
      const pdfMeta = (artifacts as any).pdf?.metadata || {};
      const songMeta = (artifacts as any).song?.metadata || {};

      documents.push({
        id: `doc_${docNum}`,
        title: textMeta.title || audioMeta.title || pdfMeta.title || `Chapter ${docNum}`,
        system: textMeta.system || audioMeta.system || pdfMeta.system || 'unknown',
        docType: textMeta.docType || audioMeta.docType || pdfMeta.docType || 'unknown',
        docNum,
        // Include URLs if available (signed URLs already generated above)
        audioUrl: (artifacts as any).audio?.public_url,
        pdfUrl: (artifacts as any).pdf?.public_url,
        songUrl: (artifacts as any).song?.public_url, // Personalized song URL
        // Don't include full text in response (too large) - can be fetched separately
      });
    }

    // Set results.documents
    if (!jobWithArtifacts.results) {
      jobWithArtifacts.results = {};
    }
    jobWithArtifacts.results.documents = documents;

    console.log(`📋 Built ${documents.length} documents from ${jobWithArtifacts.artifacts.length} artifacts`);
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

  const docs = Array.from(
    new Set(
      docsParam
        .split(',')
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 16)
    )
  ).sort((a, b) => a - b);

  if (docs.length === 0) {
    return c.json({ success: false, error: 'Missing docs query param (e.g. ?docs=1,2,3,4,5)' }, 400);
  }

  const includeSet = new Set(
    includeParam
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const includePdf = includeSet.has('pdf');
  const includeAudio = includeSet.has('audio');
  const includeSong = includeSet.has('song');

  // Verify job belongs to the authenticated user (RLS)
  const userClient = createSupabaseUserClientFromAccessToken(accessToken);
  if (!userClient) return c.json({ success: false, error: 'Supabase user client not configured' }, 500);

  const { data: jobRow, error: jobErr } = await userClient
    .from('jobs')
    .select('id,user_id,status,type,created_at,params')
    .eq('id', jobId)
    .single();

  if (jobErr || !jobRow) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  // Use service role for storage signed URLs (RLS-safe, avoids failures)
  const serviceClient = supabaseService;

  const { data: artifacts, error: artErr } = await serviceClient
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId)
    .in('artifact_type', [
      ...(includePdf ? (['pdf'] as const) : []),
      ...(includeAudio ? (['audio_mp3', 'audio_m4a'] as const) : []),
      ...(includeSong ? (['audio_song'] as const) : []),
    ])
    .order('created_at', { ascending: true });

  if (artErr) {
    return c.json({ success: false, error: `Failed to fetch artifacts: ${artErr.message}` }, 500);
  }

  // Map task_id → sequence to derive docNum when metadata is missing (same logic as /v2/:jobId handler)
  const tasks = await jobQueueV2.getJobTasks(jobId);
  const taskIdToSequence: Record<string, number> = {};
  for (const t of tasks) taskIdToSequence[t.id] = t.sequence;

  const docKey = (docNum: number) => (docs.includes(docNum) ? docNum : null);

  const byDoc: Record<number, { pdf?: any; audio?: any; song?: any; meta?: any }> = {};
  for (const a of artifacts || []) {
    let docNum = a.metadata?.docNum;
    if (typeof docNum !== 'number' && a.task_id) {
      const seq = taskIdToSequence[a.task_id];
      if (typeof seq === 'number') {
        if (seq >= 300) docNum = seq - 299; // songs
        else if (seq >= 200) docNum = seq - 199; // audio
        else if (seq >= 100) docNum = seq - 99; // pdf
        else docNum = seq + 1; // text
      }
    }
    if (typeof docNum !== 'number') continue;
    if (!docKey(docNum)) continue;
    if (!byDoc[docNum]) byDoc[docNum] = {};

    if (a.artifact_type === 'pdf') byDoc[docNum].pdf = a;
    if (a.artifact_type === 'audio_song') byDoc[docNum].song = a;
    if (a.artifact_type === 'audio_mp3' || a.artifact_type === 'audio_m4a') byDoc[docNum].audio = a;
    byDoc[docNum].meta = byDoc[docNum].meta || a.metadata || {};
  }

  // Strict readiness: if requested include types are missing for any doc, return 409
  const missing: Array<{ docNum: number; missing: string[] }> = [];
  for (const d of docs) {
    const row = byDoc[d] || {};
    const m: string[] = [];
    if (includePdf && !row.pdf?.storage_path) m.push('pdf');
    if (includeAudio && !row.audio?.storage_path) m.push('audio');
    if (includeSong && !row.song?.storage_path) m.push('song');
    if (m.length) missing.push({ docNum: d, missing: m });
  }
  if (missing.length) {
    return c.json({ success: false, error: 'Artifacts not ready', missing }, 409);
  }

  const safe = (s: string) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  const baseName = safe(
    String(
      (jobRow.params as any)?.person1?.name && (jobRow.params as any)?.person2?.name
        ? `${(jobRow.params as any)?.person1?.name}_${(jobRow.params as any)?.person2?.name}`
        : (jobRow.params as any)?.person?.name || 'reading'
    )
  );
  const zipName = `${baseName}_${jobId.slice(0, 8)}.zip`;

  const out = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('❌ ZIP archive error:', err);
    out.destroy(err);
  });
  archive.pipe(out);

  // Build and append each file stream
  for (const d of docs) {
    const row = byDoc[d]!;
    const meta = row.meta || {};
    const system = safe(meta.system || `doc_${d}`);
    const docType = safe(meta.docType || '');

    const prefix = `${String(d).padStart(2, '0')}_${system}${docType ? `_${docType}` : ''}`;

    const add = async (storagePath: string, name: string) => {
      const signed = await getSignedArtifactUrl(storagePath, 60 * 60);
      if (!signed) throw new Error(`Failed to sign ${storagePath}`);
      const resp = await axios.get(signed, { responseType: 'stream' });
      archive.append(resp.data, { name });
    };

    if (includePdf) await add(row.pdf.storage_path, `${prefix}.pdf`);
    if (includeAudio) {
      const ext = row.audio?.artifact_type === 'audio_m4a' ? 'm4a' : 'mp3';
      await add(row.audio.storage_path, `${prefix}_narration.${ext}`);
    }
    if (includeSong) await add(row.song.storage_path, `${prefix}_song.mp3`);
  }

  archive.finalize().catch((err) => {
    console.error('[ZIP] archive.finalize() failed:', err);
  });

  const headers = new Headers();
  headers.set('content-type', 'application/zip');
  headers.set('content-disposition', `attachment; filename="${zipName}"`);
  headers.set('cache-control', 'no-store');

  // Convert Node stream to Web stream for Response
  const body = Readable.toWeb(out) as any;
  return new Response(body, { status: 200, headers });
});

// DEBUG: Get all tasks for a job (requires JWT auth)
router.get('/v2/:jobId/tasks', jwtAuth, async (c) => {

  const jobId = c.req.param('jobId');
  const tasks = await jobQueueV2.getJobTasks(jobId);
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
router.delete('/v2/:jobId', jwtAuth, async (c) => {

  const jobId = c.req.param('jobId');
  if (!env.SUPABASE_URL) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }
  if (!supabaseService) {
    return c.json({ success: false, error: 'Supabase service role key not configured' }, 500);
  }
  const supabase = supabaseService;

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
router.get('/v2/user/:userId/jobs', jwtAuth, async (c) => {
  const authUserId = c.get('userId');
  const userId = c.req.param('userId');
  // Users can only list their own jobs
  if (authUserId !== userId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const jobs = await jobQueueV2.getUserJobs(userId, limit);
  
  // Fetch tasks for each job to show detailed status
  const jobsWithDetails = await Promise.all(
    jobs.map(async (j) => {
      const tasks = await jobQueueV2.getJobTasks(j.id);
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
        percent: (j.progress as any)?.percent,
        tasksComplete: (j.progress as any)?.tasksComplete,
        tasksTotal: (j.progress as any)?.tasksTotal,
        taskBreakdown: tasksByStatus,
        systems: (j.params as any)?.systems || [],
        // CRITICAL: Include person IDs AND names so frontend can link jobs to people cards
        params: {
          person1: (j.params as any)?.person1 ? { 
            id: (j.params as any).person1.id,
            name: (j.params as any).person1.name 
          } : undefined,
          person2: (j.params as any)?.person2 ? { 
            id: (j.params as any).person2.id,
            name: (j.params as any).person2.name 
          } : undefined,
          systems: (j.params as any)?.systems || [],
        },
      };
    })
  );
  
  return c.json({
    success: true,
    totalJobs: jobs.length,
    jobs: jobsWithDetails,
  });
});

// Audio streaming endpoint: /api/jobs/v2/:jobId/audio/:docNum
// Returns a redirect to the signed URL for the audio artifact
router.get('/v2/:jobId/audio/:docNum', async (c) => {
  const jobId = c.req.param('jobId');
  const docNum = parseInt(c.req.param('docNum'), 10);
  const rangeHeader = c.req.header('range') || c.req.header('Range') || null;
  
  appendAgentDebug('jobs.ts:465', 'Audio endpoint called', { jobId: jobId.substring(0, 8), docNum }, 'C');
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  if (!Number.isFinite(docNum) || docNum < 1) {
    return c.json({ success: false, error: 'Invalid docNum' }, 400);
  }

  try {
    const { jobQueueV2 } = await import('../services/jobQueueV2');
    const job = await jobQueueV2.getJob(jobId);
    
    if (!job) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }

    // Get all artifacts for this job
    const supabase = supabaseService;
    
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .in('artifact_type', ['audio_mp3', 'audio_m4a'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching audio artifacts:', JSON.stringify(error, null, 2));
      return c.json({ success: false, error: `Failed to fetch audio artifacts: ${error.message || JSON.stringify(error)}` }, 500);
    }

    if (!artifacts || artifacts.length === 0) {
      return c.json({ success: false, error: 'No audio artifacts found' }, 404);
    }

    // Find artifact matching docNum (from metadata or derive from task sequence)
    let audioArtifact = artifacts.find((a: any) => a.metadata?.docNum === docNum);
    
    appendAgentDebug(
      'jobs.ts:507',
      'Audio artifact search',
      {
        jobId: jobId.substring(0, 8),
        requestedDocNum: docNum,
        totalArtifacts: artifacts.length,
        artifactMetadata: artifacts.map((a: any) => ({
          docNum: a.metadata?.docNum,
          system: a.metadata?.system,
          docType: a.metadata?.docType,
        })),
        foundMatch: !!audioArtifact,
        matchedDocNum: audioArtifact?.metadata?.docNum,
      },
      'C'
    );
    
    // If not found by metadata, try to match by task sequence
    if (!audioArtifact) {
      const tasks = await jobQueueV2.getJobTasks(jobId);
      const taskIdToSequence: Record<string, number> = {};
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
      console.error(`❌ Audio artifact not found for job ${jobId}, docNum ${docNum}. Available artifacts: ${artifacts.length}`);
      return c.json({ success: false, error: `Audio artifact not found for docNum ${docNum}` }, 404);
    }

    console.log(`✅ Found audio artifact for docNum ${docNum}: ${audioArtifact.storage_path}`);

    // Get signed URL (valid for 1 hour)
    const signedUrl = await getSignedArtifactUrl(audioArtifact.storage_path, 3600);
    
    if (!signedUrl) {
      return c.json({ success: false, error: 'Failed to generate signed URL' }, 500);
    }

    // Stream the audio bytes directly (iOS AVPlayer has issues with redirects).
    // IMPORTANT: Support HTTP Range requests so seeking works.
    console.log(
      `🎵 Streaming audio from: ${signedUrl.substring(0, 80)}...${rangeHeader ? ` (Range: ${rangeHeader})` : ''}`
    );
    const audioResponse = await fetch(signedUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });
    
    if (!audioResponse.ok) {
      console.error(`❌ Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
      return c.json({ success: false, error: 'Failed to fetch audio from storage' }, 500);
    }

    const headers = new Headers();
    const passthroughKeys = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'];
    for (const k of passthroughKeys) {
      const v = audioResponse.headers.get(k);
      if (v) headers.set(k, v);
    }
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public, max-age=3600');

    // Return streaming response with upstream status (200 or 206)
    return new Response(audioResponse.body, { status: audioResponse.status, headers });
  } catch (error: any) {
    console.error('Error in audio endpoint:', error);
    return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
  }
});

// Song download endpoint: /api/jobs/v2/:jobId/song/:docNum
// Returns a redirect to the signed URL for the song artifact
router.get('/v2/:jobId/song/:docNum', async (c) => {
  const jobId = c.req.param('jobId');
  const docNum = parseInt(c.req.param('docNum'), 10);
  const rangeHeader = c.req.header('range') || c.req.header('Range') || null;
  
  appendAgentDebug('jobs.ts:580', 'Song endpoint called', { jobId: jobId.substring(0, 8), docNum }, 'D');
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  if (!Number.isFinite(docNum) || docNum < 1) {
    return c.json({ success: false, error: 'Invalid docNum' }, 400);
  }

  try {
    const { jobQueueV2 } = await import('../services/jobQueueV2');
    const job = await jobQueueV2.getJob(jobId);
    
    if (!job) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }

    // Get all song artifacts for this job
    const supabase = supabaseService;
    
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .eq('artifact_type', 'audio_song')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching song artifacts:', error);
      return c.json({ success: false, error: 'Failed to fetch song artifacts' }, 500);
    }

    if (!artifacts || artifacts.length === 0) {
      return c.json({ success: false, error: 'No song artifacts found' }, 404);
    }

    // Find artifact matching docNum exactly (from metadata or derive from task sequence)
    let songArtifact = artifacts.find((a: any) => a.metadata?.docNum === docNum);

    // If not found by metadata, try to match by task sequence
    if (!songArtifact) {
      const tasks = await jobQueueV2.getJobTasks(jobId);
      const taskIdToSequence: Record<string, number> = {};
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
      console.error(`❌ Song artifact not found for job ${jobId}, docNum ${docNum}. Available artifacts: ${artifacts.length}`);
      return c.json({ success: false, error: `Song artifact not found for docNum ${docNum}` }, 404);
    }

    console.log(`✅ Found song artifact for docNum ${docNum}: ${songArtifact.storage_path}`);

    // Get the URL to fetch from (prefer public, fallback to signed)
    let fetchUrl = songArtifact.public_url;
    if (!fetchUrl) {
      fetchUrl = await getSignedArtifactUrl(songArtifact.storage_path, 3600);
    }
    
    if (!fetchUrl) {
      return c.json({ success: false, error: 'Failed to generate URL' }, 500);
    }

    // Stream the song bytes directly (iOS AVPlayer has issues with redirects).
    // IMPORTANT: Support HTTP Range requests so seeking works.
    console.log(
      `🎵 Streaming song from: ${fetchUrl.substring(0, 80)}...${rangeHeader ? ` (Range: ${rangeHeader})` : ''}`
    );
    const songResponse = await fetch(fetchUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });
    
    if (!songResponse.ok) {
      console.error(`❌ Failed to fetch song: ${songResponse.status} ${songResponse.statusText}`);
      return c.json({ success: false, error: 'Failed to fetch song from storage' }, 500);
    }

    const headers = new Headers();
    const passthroughKeys = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'];
    for (const k of passthroughKeys) {
      const v = songResponse.headers.get(k);
      if (v) headers.set(k, v);
    }
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public, max-age=3600');

    // Return streaming response with upstream status (200 or 206)
    return new Response(songResponse.body, { status: songResponse.status, headers });
  } catch (error: any) {
    console.error('Error in song endpoint:', error);
    return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
  }
});

// Song metadata endpoint: /api/jobs/v2/:jobId/song/:docNum/metadata
// Returns song title and lyrics (no audio)
router.get('/v2/:jobId/song/:docNum/metadata', async (c) => {
  const jobId = c.req.param('jobId');
  const docNum = parseInt(c.req.param('docNum'), 10);
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  if (!Number.isFinite(docNum) || docNum < 1) {
    return c.json({ success: false, error: 'Invalid docNum' }, 400);
  }

  try {
    const { jobQueueV2 } = await import('../services/jobQueueV2');
    const job = await jobQueueV2.getJob(jobId);
    
    if (!job) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }

    // Get song artifact metadata for this job
    const supabase = supabaseService;
    
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .eq('artifact_type', 'audio_song')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching song artifacts:', error);
      return c.json({ success: false, error: 'Failed to fetch song artifacts' }, 500);
    }

    if (!artifacts || artifacts.length === 0) {
      return c.json({ success: false, error: 'No song artifacts found' }, 404);
    }

    // Find artifact matching docNum
    let songArtifact = artifacts.find((a: any) => a.metadata?.docNum === docNum);
    
    // If not found by metadata, try to match by task sequence
    if (!songArtifact) {
      const tasks = await jobQueueV2.getJobTasks(jobId);
      const taskIdToSequence: Record<string, number> = {};
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
  } catch (error: any) {
    console.error('Error in song metadata endpoint:', error);
    return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
  }
});

// PDF download endpoint: /api/jobs/v2/:jobId/pdf/:docNum
// Returns the PDF artifact as application/pdf
router.get('/v2/:jobId/pdf/:docNum', async (c) => {
  const jobId = c.req.param('jobId');
  const docNum = parseInt(c.req.param('docNum'), 10);
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  if (!Number.isFinite(docNum) || docNum < 1) {
    return c.json({ success: false, error: 'Invalid docNum' }, 400);
  }

  try {
    const { jobQueueV2 } = await import('../services/jobQueueV2');
    const job = await jobQueueV2.getJob(jobId);
    
    if (!job) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }

    // Get all PDF artifacts for this job
    const supabase = supabaseService;
    
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pdf')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching PDF artifacts:', error);
      return c.json({ success: false, error: 'Failed to fetch PDF artifacts' }, 500);
    }

    if (!artifacts || artifacts.length === 0) {
      return c.json({ success: false, error: 'No PDF artifacts found' }, 404);
    }

    // Find artifact matching docNum exactly (from metadata or derive from task sequence)
    let pdfArtifact = artifacts.find((a: any) => a.metadata?.docNum === docNum);
    
    // If not found by metadata, try to match by task sequence
    if (!pdfArtifact) {
      const tasks = await jobQueueV2.getJobTasks(jobId);
      const taskIdToSequence: Record<string, number> = {};
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
      console.error(`❌ PDF artifact not found for job ${jobId}, docNum ${docNum}. Available artifacts: ${artifacts.length}`);
      return c.json({ success: false, error: `PDF artifact not found for docNum ${docNum}` }, 404);
    }

    console.log(`✅ Found PDF artifact for docNum ${docNum}: ${pdfArtifact.storage_path}`);

    // Get the URL to fetch from (prefer public, fallback to signed)
    let fetchUrl = pdfArtifact.public_url;
    if (!fetchUrl) {
      fetchUrl = await getSignedArtifactUrl(pdfArtifact.storage_path, 3600);
    }
    
    if (!fetchUrl) {
      return c.json({ success: false, error: 'Failed to generate URL' }, 500);
    }

    // Stream the PDF bytes directly
    console.log(`📄 Streaming PDF from: ${fetchUrl.substring(0, 80)}...`);
    const pdfResponse = await fetch(fetchUrl);
    
    if (!pdfResponse.ok) {
      console.error(`❌ Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      return c.json({ success: false, error: 'Failed to fetch PDF from storage' }, 500);
    }

    const headers = new Headers();
    headers.set('content-type', 'application/pdf');
    const contentLength = pdfResponse.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);
    headers.set('cache-control', 'public, max-age=3600');

    // Return PDF stream
    return new Response(pdfResponse.body, { status: 200, headers });
  } catch (error: any) {
    console.error('Error in PDF endpoint:', error);
    return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
  }
});

// DEBUG: Reset stuck tasks (requires JWT auth)
router.post('/v2/:jobId/reset-stuck', jwtAuth, async (c) => {

  const jobId = c.req.param('jobId');
  if (!env.SUPABASE_URL) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  if (!supabaseService) {
    return c.json({ success: false, error: 'Supabase service role key not configured' }, 500);
  }
  const supabase = supabaseService;

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
    resetTasks: data?.map((t: any) => ({ id: t.id, sequence: t.sequence, task_type: t.task_type })),
  });
});



export default router;
