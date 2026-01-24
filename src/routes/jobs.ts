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
import { z } from 'zod';
import { jobQueue, Job } from '../services/jobQueue';
import { jobQueueV2 } from '../services/jobQueueV2';
import { createSupabaseUserClientFromAccessToken, getSignedArtifactUrl } from '../services/supabaseClient';
import { swissEngine } from '../services/swissEphemeris';
import { env } from '../config/env';
import axios from 'axios';
import { llm, llmPaid } from '../services/llm'; // llm = DeepSeek (hooks), llmPaid = Claude (deep readings)
import { checkUserSubscription, markIncludedReadingUsed } from '../services/subscriptionService';
import { SYSTEMS as NUCLEAR_V2_SYSTEMS, SYSTEM_DISPLAY_NAMES as NUCLEAR_V2_SYSTEM_NAMES, type SystemName as NuclearV2SystemName, NUCLEAR_DOCS, VERDICT_DOC, buildPersonPrompt, buildOverlayPrompt as buildNuclearV2OverlayPrompt, buildVerdictPrompt } from '../prompts/structures/paidReadingPrompts';
import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';
import {
  buildIndividualPrompt,
  buildOverlayPrompt,
  PersonData,
  ChartData,
  StyleName,
  SpiceLevel,
} from '../prompts';
import { generateChapterPDF } from '../services/pdf/pdfGenerator';

const router = new Hono();

function getBearerToken(c: any): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// V2: Supabase-backed job read (RLS enforced).
// This is safe to expose to clients; it will never leak cross-user jobs.
const getJobHandler = async (c: any) => {
  const accessToken = getBearerToken(c);

  // If no auth token, use service role (for dev mode)
  const jobId = c.req.param('jobId');
  let job, error;

  if (!accessToken) {
    // Dev mode - use service role client
    const { jobQueueV2 } = await import('../services/jobQueueV2');
    const result = await jobQueueV2.getJob(jobId);
    if (!result) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }
    job = result;
    error = null;
  } else {
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
  }

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
      } else if (artifact.artifact_type === 'audio' || artifact.artifact_type === 'audio_mp3' || artifact.artifact_type === 'audio_m4a') {
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
  const { createClient } = await import('@supabase/supabase-js');
  const serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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

  archive.finalize().catch(() => {});

  const headers = new Headers();
  headers.set('content-type', 'application/zip');
  headers.set('content-disposition', `attachment; filename="${zipName}"`);
  headers.set('cache-control', 'no-store');

  // Convert Node stream to Web stream for Response
  const body = Readable.toWeb(out) as any;
  return new Response(body, { status: 200, headers });
});

// DEBUG: Get all tasks for a job
router.get('/v2/:jobId/tasks', async (c) => {
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

// DEBUG: Delete a job
router.delete('/v2/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!env.SUPABASE_URL) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!);

  // Get job to find user_id for storage path
  const { data: job } = await supabase.from('jobs').select('user_id').eq('id', jobId).single();
  const userId = job?.user_id;

  // Delete storage artifacts BEFORE deleting database record
  if (userId) {
    const storagePath = `${userId}/${jobId}`;
    try {
      // List all files in job folder
      const { data: folders } = await supabase.storage.from('job-artifacts').list(storagePath);
      for (const folder of folders || []) {
        const folderPath = `${storagePath}/${folder.name}`;
        const { data: files } = await supabase.storage.from('job-artifacts').list(folderPath);
        if (files && files.length > 0) {
          const filePaths = files.map((f: any) => `${folderPath}/${f.name}`);
          await supabase.storage.from('job-artifacts').remove(filePaths);
        }
      }
      console.log(`🗑️ Cleaned storage artifacts for job ${jobId}`);
    } catch (storageErr) {
      console.warn(`⚠️ Storage cleanup failed for job ${jobId}:`, storageErr);
      // Continue with job deletion even if storage cleanup fails
    }
  }

  // Delete job (cascades to tasks and artifacts in DB)
  const { error } = await supabase.from('jobs').delete().eq('id', jobId);
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
  return c.json({ success: true, deleted: jobId });
});

// DEBUG: List all jobs for a user
router.get('/v2/user/:userId/jobs', async (c) => {
  const userId = c.req.param('userId');
  const jobs = await jobQueueV2.getUserJobs(userId, 10);
  
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
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
    let audioArtifact = artifacts.find(a => a.metadata?.docNum === docNum);
    
    
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

    // Proxy stream (do not redirect): iOS AVPlayer has issues with redirects when streaming.
    // PDF uses redirect (client downloads directly from Supabase) for faster download.
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
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
    let songArtifact = artifacts.find(a => a.metadata?.docNum === docNum);
    
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
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
    let pdfArtifact = artifacts.find(a => a.metadata?.docNum === docNum);
    
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

    // Get signed URL (prefer public, fallback to signed)
    let signedUrl = pdfArtifact.public_url;
    if (!signedUrl) {
      signedUrl = await getSignedArtifactUrl(pdfArtifact.storage_path, 3600);
    }

    if (!signedUrl) {
      return c.json({ success: false, error: 'Failed to generate URL' }, 500);
    }

    // Redirect to signed URL so client downloads directly from Supabase.
    // Previously we proxied: backend fetched full PDF from Supabase then streamed to client,
    // which caused ~1 min delay (two full transfers). Redirect = one transfer, much faster.
    console.log(`📄 Redirecting PDF to signed URL (direct Supabase download)`);
    return c.redirect(signedUrl, 302);
  } catch (error: any) {
    console.error('Error in PDF endpoint:', error);
    return c.json({ success: false, error: error.message || 'Internal server error' }, 500);
  }
});

// DEBUG: Reset stuck tasks (claimed/processing but stale)
router.post('/v2/:jobId/reset-stuck', async (c) => {
  const jobId = c.req.param('jobId');
  if (!env.SUPABASE_URL) {
    return c.json({ success: false, error: 'Supabase not configured' }, 500);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!);

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


/**
 * Nuclear V2 plan endpoint (NO job creation, NO LLM).
 * Use this to verify Option B document ordering instantly.
 *
 * Example:
 *   GET /api/jobs/nuclear-v2/plan?systems=western,vedic,human_design
 */
router.get('/nuclear-v2/plan', async (c) => {
  const raw = (c.req.query('systems') || '').trim();
  const requested = raw
    ? raw.split(',').map((x) => x.trim()).filter(Boolean)
    : Array.from(NUCLEAR_V2_SYSTEMS);

  const systems = requested.filter((sys): sys is NuclearV2SystemName =>
    (NUCLEAR_V2_SYSTEMS as readonly string[]).includes(sys)
  );

  // Option B: all solos first (per system), then all synastry, then verdict.
  const docs: Array<{ id: string; system: NuclearV2SystemName | null; docType: 'person1' | 'person2' | 'overlay' | null; title: string }> = [];
  let id = 1;

  for (const system of systems) {
    docs.push({ id: String(id++), system, docType: 'person1', title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - Person 1` });
    docs.push({ id: String(id++), system, docType: 'person2', title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - Person 2` });
  }
  for (const system of systems) {
    docs.push({ id: String(id++), system, docType: 'overlay', title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - Synastry` });
  }
  docs.push({ id: String(id++), system: null, docType: null, title: 'Final Verdict' });

  return c.json({
    success: true,
    systems,
    totalDocs: docs.length,
    firstSix: docs.slice(0, 6).map((d) => d.title),
    docs,
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// LLM SERVICE - Centralized in src/services/llm.ts
// Change LLM_PROVIDER env var to switch between: deepseek | claude | openai
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Validate spice level
// ═══════════════════════════════════════════════════════════════════════════

function validateSpiceLevel(level: number): SpiceLevel {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return clamped as SpiceLevel;
}

// HELPER: Get user's saved relationship preference from Supabase
async function getUserRelationshipPreference(userId: string): Promise<number | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('library_people')
      .select('relationship_intensity')
      .eq('user_id', userId)
      .eq('is_user', true)
      .maybeSingle();

    if (error) {
      console.error('Error retrieving user relationship preference:', error.message);
      return null;
    }

    return data?.relationship_intensity ?? null;
  } catch (err) {
    console.error('Exception retrieving user relationship preference:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const startJobSchema = z.object({
  type: z.enum(['extended', 'synastry', 'nuclear', 'nuclear_v2']),
  systems: z.array(z.string()).default(['western']),
  style: z.enum(['production', 'spicy_surreal']).default('spicy_surreal'),
  person1: z.object({
    id: z.string().optional(), // CRITICAL: Unique person ID for matching (not just name!)
    name: z.string(),
    birthDate: z.string(),
    birthTime: z.string(),
    timezone: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  person2: z.object({
    id: z.string().optional(), // CRITICAL: Unique person ID for matching (not just name!)
    name: z.string(),
    birthDate: z.string(),
    birthTime: z.string(),
    timezone: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  relationshipIntensity: z.number().min(1).max(10).default(5),
  relationshipContext: z.string().max(500).optional(), // Contextual infusion for overlay interpretation
  personalContext: z.string().max(500).optional(), // Contextual infusion for individual readings
  voiceId: z.string().optional(), // Voice narrator ID (e.g., 'david', 'elisabeth')
  audioUrl: z.string().optional(), // Optional direct audio URL (WAV for RunPod training)
  useIncludedReading: z.boolean().optional(), // Flag: use the one included reading from subscription
});

// LLM calls now use centralized llm.generate() from ../services/llm
// Provider controlled by LLM_PROVIDER env (default: deepseek)

// ═══════════════════════════════════════════════════════════════════════════
// TTS GENERATION - Chunked with stitching
// ═══════════════════════════════════════════════════════════════════════════

// Split text into chunks for TTS (handles long sentences by word-splitting)
function splitTextForTTS(text: string, maxChars: number = 300): string[] {
  const sentenceRegex = /[^.!?]*[.!?]+|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 1 < maxChars) {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (trimmed.length > maxChars) {
        const words = trimmed.split(/\s+/);
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 < maxChars) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks.length > 0 ? chunks : [text];
}

async function generateAudioForText(text: string, label: string): Promise<{ audioBase64: string; duration: number } | null> {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
    console.log(`⏭️ RunPod not configured, skipping audio for ${label}`);
    return null;
  }

  try {
    console.log(`🎙️ Generating audio for ${label} (${text.length} chars)...`);

    // Call internal audio endpoint (handles chunking, concatenation, compression)
    const audioResponse = await axios.post(
      `http://localhost:${env.PORT}/api/audio/generate-tts`,
      {
        text,
        provider: 'chatterbox',
        exaggeration: 0.3,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 600000, // 10 min for long texts
      }
    );

    if (audioResponse.data.success && audioResponse.data.audio) {
      // Estimate duration: ~150 words per minute
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.round((wordCount / 150) * 60);

      console.log(`✅ Audio generated for ${label} (${estimatedDuration}s)`);
      return {
        audioBase64: audioResponse.data.audio,
        duration: estimatedDuration,
      };
    }

    return null;
  } catch (error: any) {
    console.error(`❌ Audio generation failed for ${label}:`, error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Start a job (V2 - Supabase queue for RunPod workers)
router.post('/v2/start', async (c) => {
  try {
    const payload = startJobSchema.parse(await c.req.json());
    console.log(`📥 Starting ${payload.type} job (V2) for ${payload.person1.name}`);

    // Check if Supabase is configured
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return c.json({
        success: false,
        error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env. See docs/SUPABASE_QUEUE_SETUP.md'
      }, 500);
    }

    // Get user ID from header (or use test user for development)
    const userId = c.req.header('X-User-Id') || '00000000-0000-0000-0000-000000000001';

    console.log('👤 Creating job for user:', userId);

    // ═══════════════════════════════════════════════════════════════════════
    // AUTHORIZATION: Check if user can use their included reading
    // ═══════════════════════════════════════════════════════════════════════
    if (payload.useIncludedReading && payload.type === 'extended') {
      console.log('🔐 Checking included reading entitlement...');
      
      const subscription = await checkUserSubscription(userId);
      
      if (!subscription || subscription.status !== 'active') {
        console.warn(`❌ User ${userId} has no active subscription`);
        return c.json({ 
          success: false, 
          error: 'Active subscription required to use included reading' 
        }, 403);
      }
      
      if (subscription.included_reading_used) {
        console.warn(`❌ User ${userId} has already used their included reading`);
        return c.json({ 
          success: false, 
          error: 'You have already used your included reading. Please purchase a reading separately.' 
        }, 403);
      }
      
      console.log(`✅ User ${userId} can use their included reading`);
    }

    // Resolve voice and set audioUrl (WAV for RunPod training) if voiceId provided
    let audioUrl = payload.audioUrl;
    if (payload.voiceId && !audioUrl) {
      const { getVoiceById, getEnabledVoices } = await import('../config/voices');
      const voice = getVoiceById(payload.voiceId);
      if (voice) {
        audioUrl = voice.sampleAudioUrl; // Use WAV URL for RunPod training
        console.log(`🎤 Resolved voice: ${voice.displayName} → ${audioUrl.substring(0, 80)}...`);
      } else {
        // Fallback to first available voice if requested voice not found
        const availableVoices = getEnabledVoices();
        if (availableVoices.length > 0) {
          const fallbackVoice = availableVoices[0];
          audioUrl = fallbackVoice.sampleAudioUrl;
          console.warn(`⚠️  Voice '${payload.voiceId}' not found, using fallback: ${fallbackVoice.displayName}`);
        } else {
          console.error(`❌ No voices available! Voice '${payload.voiceId}' not found and no fallback available.`);
        }
      }
    }

    // NOTE: Task creation is handled automatically by the database trigger auto_create_job_tasks()
    // (see migration 008_auto_create_job_tasks.sql). The trigger creates tasks based on job.type:
    // - nuclear_v2: 16 text tasks (5 systems × 3 docs each + verdict)
    // - extended: tasks based on params.systems array
    // - synastry: overlay tasks based on params.systems
    // Song generation happens via post-processing (songWorker) after text completes.

    // NOTE: Do NOT pass tasks array - the database trigger auto_create_job_tasks() 
    // automatically creates tasks when a job is inserted (see migration 008)
    const jobId = await jobQueueV2.createJob({
      userId,
      type: payload.type,
      params: {
        ...payload,
        systems: payload.systems,
        audioUrl, // WAV URL for RunPod training (resolved from voiceId if needed)
        relationshipContext: payload.relationshipContext, // Pass through for overlay interpretation
        personalContext: payload.personalContext, // Pass through for individual reading personalization
      },
      // tasks: tasks as any, // REMOVED - handled by DB trigger
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Mark included reading as used (if applicable)
    // ═══════════════════════════════════════════════════════════════════════
    if (payload.useIncludedReading && payload.type === 'extended') {
      const system = payload.systems[0]; // User chose one system
      const marked = await markIncludedReadingUsed(userId, system, jobId);
      if (!marked) {
        console.warn(`⚠️  Failed to mark included reading as used for user ${userId}`);
      }
    }

    return c.json({
      success: true,
      jobId,
      message: `Job ${jobId} queued (V2 - RunPod workers)`,
    });
  } catch (error: any) {
    console.error('Job start error (V2):', error);
    return c.json({
      success: false,
      error: error.message
    }, 400);
  }
});

// Start a job (Legacy - in-process queue)
router.post('/start', async (c) => {
  try {
    const payload = startJobSchema.parse(await c.req.json());
    console.log(`📥 Starting ${payload.type} job (legacy) for ${payload.person1.name}`);

    const jobId = jobQueue.createJob(payload.type, {
      ...payload,
      systems: payload.systems,
    });

    return c.json({
      success: true,
      jobId,
      message: `Job ${jobId} started (legacy)`,
    });
  } catch (error: any) {
    console.error('Job start error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 400);
  }
});

// Get job status
router.get('/queue-status', async (c) => {
  return c.json({
    success: true,
    message: 'Rate limiter active: 3s delay between Claude calls, 8192 max_tokens',
    activeJobs: jobQueue.getAllJobs().filter(j => j.status === 'processing').length,
    totalJobs: jobQueue.getAllJobs().length,
  });
});

router.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = jobQueue.getJob(jobId);

  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }

  // Get audio generation status if job is complete
  let audioStatus = null;
  if (job.status === 'complete' && job.type === 'nuclear_v2') {
    const { getAudioStatus } = await import('../services/asyncAudioService');
    audioStatus = await getAudioStatus(jobId);
  }

  return c.json({
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      results: job.status === 'complete' ? job.results : undefined,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    audioStatus, // null if not applicable, otherwise { status, completed, total, failed }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build ChartData from Swiss Ephemeris placements
// ═══════════════════════════════════════════════════════════════════════════

function buildChartData(
  name: string,
  placements: any,
  placements2?: any,
  name2?: string
): ChartData {
  const formatDegree = (d: any) => d ? `${d.degree}° ${d.minute}'` : '';

  const p1Western = `
${name.toUpperCase()} WESTERN CHART:
- Sun: ${placements.sunSign} ${formatDegree(placements.sunDegree)}
- Moon: ${placements.moonSign} ${formatDegree(placements.moonDegree)}
- Rising: ${placements.risingSign} ${formatDegree(placements.ascendantDegree)}
`;

  const chartData: ChartData = {
    western: p1Western,
    vedic: `[Vedic data for ${name}]`,
    geneKeys: `[Gene Keys data for ${name}]`,
    humanDesign: `[Human Design data for ${name}]`,
    kabbalah: `[Kabbalah data for ${name}]`,
  };

  // Add second person if provided
  if (placements2 && name2) {
    const p2Western = `
${name2.toUpperCase()} WESTERN CHART:
- Sun: ${placements2.sunSign} ${formatDegree(placements2.sunDegree)}
- Moon: ${placements2.moonSign} ${formatDegree(placements2.moonDegree)}
- Rising: ${placements2.risingSign} ${formatDegree(placements2.ascendantDegree)}
`;
    chartData.western += '\n' + p2Western;
    chartData.synastry = `[Synastry aspects between ${name} and ${name2}]`;
  }

  return chartData;
}

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR PROCESSOR - DELETED (replaced by nuclear_v2 with 16 documents)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED READING PROCESSOR (Single Person, Single System)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED PROCESSOR (One Person, 1-5 Systems)
// ═══════════════════════════════════════════════════════════════════════════
// Product Tiers:
// - Single Reading: 1 person, 1 system = 1 document
// - Combined Package: 1 person, 5 systems = 5 documents
// ═══════════════════════════════════════════════════════════════════════════

jobQueue.registerProcessor('extended', async (job, updateProgress) => {
  const { person1, relationshipIntensity, systems, style } = job.params;

  // Retrieve user's saved preference from Supabase if not explicitly provided
  const userPreference = await getUserRelationshipPreference(person1.userId || '');
  const spiceLevel = validateSpiceLevel(relationshipIntensity ?? userPreference ?? 5);

  const writingStyle: StyleName = style || 'production';
  
  // Support 1-5 systems (single reading OR combined package)
  const systemsToProcess = systems?.length > 0 ? systems : ['western'];
  const totalSystems = systemsToProcess.length;
  const isCombinedPackage = totalSystems > 1;

  console.log(`📦 Extended job ${job.id}: ${totalSystems} system(s) for ${person1.name}`);

  try {
    updateProgress({
      percent: 5,
      phase: 'calculating',
      message: '🔮 Calculating chart...',
      currentStep: 'Swiss Ephemeris',
    });

    const placements = await swissEngine.computePlacements({
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      timezone: person1.timezone,
      latitude: person1.latitude,
      longitude: person1.longitude,
      relationshipIntensity: spiceLevel,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });

    const chartData = buildChartData(person1.name, placements);

    const p1Data: PersonData = {
      name: person1.name,
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: `${person1.latitude.toFixed(2)}°N, ${person1.longitude.toFixed(2)}°E`,
    };

    // Generate reading for EACH system
    const chapters: { name: string; text: string; docNum: number }[] = [];
    const allTexts: string[] = [];

    for (let i = 0; i < totalSystems; i++) {
      const system = systemsToProcess[i];
      const progressPercent = 10 + Math.round((i / totalSystems) * 80);

      updateProgress({
        percent: progressPercent,
        phase: 'text',
        message: `📝 Generating ${system} analysis... (${i + 1}/${totalSystems})`,
        currentStep: `${system} - Claude API call`,
      });

      const prompt = buildIndividualPrompt({
        type: 'individual',
        style: writingStyle,
        spiceLevel,
        system: system as any,
        voiceMode: 'other', // 3rd person (using NAME)
        person: p1Data,
        chartData,
      });

      const reading = await llmPaid.generate(prompt, `extended-${system}`);

      chapters.push({
        name: system,
        text: reading,
        docNum: i + 1, // 1-indexed document number
      });
      allTexts.push(reading);

      console.log(`✅ Extended job ${job.id}: ${system} complete (${i + 1}/${totalSystems})`);
    }

    const results: Job['results'] = {
      readings: [],
      fullText: allTexts.join('\n\n---\n\n'),
      chapters,
      documents: chapters.map((ch, idx) => ({
        id: `doc_${idx + 1}`,
        title: ch.name,
        system: ch.name,
        docType: 'individual',
        text: ch.text,
        wordCount: ch.text.split(/\s+/).length,
        docNum: idx + 1,
      })),
    };

    await jobQueueV2.completeJob(job.id);
    console.log(`🎉 Extended job ${job.id} complete! Generated ${totalSystems} document(s)`);

  } catch (error: any) {
    console.error('Extended job error:', error);
    jobQueue.failJob(job.id, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SYNASTRY PROCESSOR (Two People, Single System Overlay)
// ═══════════════════════════════════════════════════════════════════════════

jobQueue.registerProcessor('synastry', async (job, updateProgress) => {
  const { person1, person2, relationshipIntensity, systems, style } = job.params;

  // Retrieve user's saved preference from Supabase if not explicitly provided
  const userPreference = await getUserRelationshipPreference(person1.userId || '');
  const spiceLevel = validateSpiceLevel(relationshipIntensity ?? userPreference ?? 5);
  const writingStyle: StyleName = style || 'production';
  const system = systems?.[0] || 'western';

  if (!person2) {
    throw new Error('person2 is required for synastry readings');
  }

  try {
    updateProgress({
      percent: 5,
      phase: 'calculating',
      message: '🔮 Calculating charts...',
      currentStep: 'Swiss Ephemeris',
    });

    const p1Placements = await swissEngine.computePlacements({
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      timezone: person1.timezone,
      latitude: person1.latitude,
      longitude: person1.longitude,
      relationshipIntensity: spiceLevel,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });

    const p2Placements = await swissEngine.computePlacements({
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      timezone: person2.timezone,
      latitude: person2.latitude,
      longitude: person2.longitude,
      relationshipIntensity: spiceLevel,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });

    const chartData = buildChartData(person1.name, p1Placements, p2Placements, person2.name);

    const p1Data: PersonData = {
      name: person1.name,
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: `${person1.latitude.toFixed(2)}°N, ${person1.longitude.toFixed(2)}°E`,
    };

    const p2Data: PersonData = {
      name: person2.name,
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${person2.latitude.toFixed(2)}°N, ${person2.longitude.toFixed(2)}°E`,
    };

    updateProgress({
      percent: 20,
      phase: 'text',
      message: `📝 Generating ${system} overlay...`,
      currentStep: 'Claude API call',
    });

    const prompt = buildOverlayPrompt({
      type: 'overlay',
      style: writingStyle,
      spiceLevel,
      system: system as any,
      person1: p1Data,
      person2: p2Data,
      chartData,
    });

    const reading = await llmPaid.generate(prompt, `synastry-${system}`);

    const results: Job['results'] = {
      readings: [],
      fullText: reading,
      chapters: [{
        name: `${system} Overlay`,
        text: reading,
      }],
    };

    await jobQueueV2.completeJob(job.id);
    console.log(`🎉 Synastry job ${job.id} complete!`);

  } catch (error: any) {
    console.error('Synastry job error:', error);
    jobQueue.failJob(job.id, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR V2 PROCESSOR - 16 Documents (Option B ordering)
// ═══════════════════════════════════════════════════════════════════════════

jobQueue.registerProcessor('nuclear_v2', async (job, updateProgress) => {
  const { person1, person2, relationshipIntensity, style } = job.params;
  const spiceLevel = validateSpiceLevel(relationshipIntensity || 5);
  const writingStyle: 'production' | 'spicy_surreal' = style || 'spicy_surreal';

  if (!person2) {
    throw new Error('person2 is required for nuclear_v2 readings');
  }

  try {
    // Calculate charts
    updateProgress({
      percent: 2,
      phase: 'calculating',
      message: '🔮 Calculating astrological charts...',
      currentStep: 'Swiss Ephemeris calculations',
    });

    const p1Placements = await swissEngine.computePlacements({
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      timezone: person1.timezone,
      latitude: person1.latitude,
      longitude: person1.longitude,
      relationshipIntensity: spiceLevel,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });

    const p2Placements = await swissEngine.computePlacements({
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      timezone: person2.timezone,
      latitude: person2.latitude,
      longitude: person2.longitude,
      relationshipIntensity: spiceLevel,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });

    const chartData = buildChartData(person1.name, p1Placements, p2Placements, person2.name);

    const p1Data = {
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: `${person1.latitude.toFixed(2)}°N, ${person1.longitude.toFixed(2)}°E`,
    };

    const p2Data = {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${person2.latitude.toFixed(2)}°N, ${person2.longitude.toFixed(2)}°E`,
    };

    // Generate 16 documents (Option B: all P1, then all P2, then all overlays, then verdict)
    const documents: Array<{ id: string; title: string; text: string; wordCount: number; system?: string; docType?: string }> = [];
    const totalDocs = 16;

    // Store individual readings for overlay context
    const individualReadings: Record<string, { p1: string; p2: string }> = {};

    // Generate 10 individual profiles (5 systems × 2 people)
    for (const system of NUCLEAR_V2_SYSTEMS) {
      // Person 1
      updateProgress({
        percent: 5 + (documents.length * 5),
        phase: 'text',
        message: `📝 ${NUCLEAR_V2_SYSTEM_NAMES[system]} - ${person1.name}...`,
        currentStep: `TEXT: Doc ${documents.length + 1}/16`,
        callsComplete: documents.length,
        callsTotal: totalDocs,
      });

      const p1Prompt = buildPersonPrompt({
        system,
        personName: person1.name,
        personData: p1Data,
        chartData: chartData as string,
        spiceLevel,
        style: writingStyle,
      });

      const p1Text = await llmPaid.generate(p1Prompt, `nuclear_v2-${system}-p1`);
      const p1WordCount = p1Text.split(/\s+/).length;
      documents.push({
        id: `${system}-p1`,
        title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - ${person1.name}`,
        text: p1Text,
        wordCount: p1WordCount,
        system,
        docType: 'person1',
      });

      if (!individualReadings[system]) individualReadings[system] = { p1: '', p2: '' };
      individualReadings[system].p1 = p1Text;

      // Person 2
      updateProgress({
        percent: 5 + (documents.length * 5),
        phase: 'text',
        message: `📝 ${NUCLEAR_V2_SYSTEM_NAMES[system]} - ${person2.name}...`,
        currentStep: `TEXT: Doc ${documents.length + 1}/16`,
        callsComplete: documents.length,
        callsTotal: totalDocs,
      });

      const p2Prompt = buildPersonPrompt({
        system,
        personName: person2.name,
        personData: p2Data,
        chartData: chartData as string,
        spiceLevel,
        style: writingStyle,
      });

      const p2Text = await llmPaid.generate(p2Prompt, `nuclear_v2-${system}-p2`);
      const p2WordCount = p2Text.split(/\s+/).length;
      documents.push({
        id: `${system}-p2`,
        title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - ${person2.name}`,
        text: p2Text,
        wordCount: p2WordCount,
        system,
        docType: 'person2',
      });

      individualReadings[system].p2 = p2Text;
    }

    // Generate 5 overlays
    for (const system of NUCLEAR_V2_SYSTEMS) {
      updateProgress({
        percent: 5 + (documents.length * 5),
        phase: 'text',
        message: `📝 ${NUCLEAR_V2_SYSTEM_NAMES[system]} Synastry...`,
        currentStep: `TEXT: Doc ${documents.length + 1}/16`,
        callsComplete: documents.length,
        callsTotal: totalDocs,
      });

      const overlayPrompt = buildNuclearV2OverlayPrompt({
        system,
        person1Name: person1.name,
        person2Name: person2.name,
        chartData: chartData as string,
        spiceLevel,
        style: writingStyle,
      });

      const overlayText = await llmPaid.generate(overlayPrompt, `nuclear_v2-${system}-overlay`);
      const overlayWordCount = overlayText.split(/\s+/).length;
      documents.push({
        id: `${system}-overlay`,
        title: `${NUCLEAR_V2_SYSTEM_NAMES[system]} - Synastry`,
        text: overlayText,
        wordCount: overlayWordCount,
        system,
        docType: 'overlay',
      });
    }

    // Generate final verdict
    updateProgress({
      percent: 95,
      phase: 'text',
      message: '📝 Final Verdict...',
      currentStep: `TEXT: Doc 16/16`,
      callsComplete: 15,
      callsTotal: totalDocs,
    });

    const allReadingsSummary = documents.slice(0, 15).map(d => `${d.title}: ${d.text.substring(0, 200)}...`).join('\n\n');

    const verdictPrompt = buildVerdictPrompt({
      person1Name: person1.name,
      person2Name: person2.name,
      allReadingsSummary,
      spiceLevel,
      style: writingStyle,
    });

    const verdictText = await llmPaid.generate(verdictPrompt, 'nuclear_v2-verdict');
    const verdictWordCount = verdictText.split(/\s+/).length;
    documents.push({
      id: 'verdict',
      title: 'Final Verdict',
      text: verdictText,
      wordCount: verdictWordCount,
      docType: 'verdict',
    });

    // Complete job immediately with text-only results
    // Audio generation will happen asynchronously via job queue tasks
    const fullText = documents.map(d => d.text).join('\n\n═══════════════════════════════════════════════════════════════════════════\n\n');

    const results: Job['results'] = {
      readings: [],
      chapters: documents.map(d => ({
        name: d.title,
        text: d.text,
        audio: null, // Audio will be populated by background workers
        duration: 0,
      })),
      fullText,
      documents: documents.map(d => ({
        ...d,
        audioBase64: undefined,
        audioPath: undefined,
        audioUrl: undefined,
        audioDuration: undefined,
      })),
    };

    await jobQueueV2.completeJob(job.id);
    console.log(`🎉 Nuclear V2 job ${job.id} complete! (16 documents, audio queued for background generation)`);

    // Trigger async audio generation via job queue
    // Audio will be generated in the background by AudioWorker instances
    const { triggerAsyncAudioGeneration } = await import('../services/asyncAudioService');
    const audioDocuments = documents.map((d, idx) => ({
      id: d.id,
      title: d.title,
      text: d.text,
      jobId: job.id,
      sequence: idx,
      system: (d as any).system ?? null,
      docType: (d as any).docType ?? null,
    }));

    triggerAsyncAudioGeneration(job.id, audioDocuments).catch(err => {
      console.error(`Failed to trigger async audio for job ${job.id}:`, err.message);
      // Don't fail the job - audio is optional
    });

  } catch (error: any) {
    console.error('Nuclear V2 job error:', error);
    jobQueue.failJob(job.id, error.message);
  }
});

export default router;
