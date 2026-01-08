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
import { llm } from '../services/llm'; // Centralized LLM service
import { SYSTEMS as NUCLEAR_V2_SYSTEMS, SYSTEM_DISPLAY_NAMES as NUCLEAR_V2_SYSTEM_NAMES, type SystemName as NuclearV2SystemName, NUCLEAR_DOCS, VERDICT_DOC, buildPersonPrompt, buildOverlayPrompt as buildNuclearV2OverlayPrompt, buildVerdictPrompt } from '../prompts/structures/nuclearV2';
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

  // Delete job (cascades to tasks and artifacts)
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
  return c.json({
    success: true,
    totalJobs: jobs.length,
    jobs: jobs.map(j => ({
      id: j.id,
      status: j.status,
      type: j.type,
      createdAt: j.created_at,
      percent: (j.progress as any)?.percent,
      tasksComplete: (j.progress as any)?.tasksComplete,
      tasksTotal: (j.progress as any)?.tasksTotal,
    })),
  });
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
    name: z.string(),
    birthDate: z.string(),
    birthTime: z.string(),
    timezone: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  person2: z.object({
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
        relationshipContext: payload.relationshipContext, // Pass through for overlay interpretation
        personalContext: payload.personalContext, // Pass through for individual reading personalization
      },
      // tasks: tasks as any, // REMOVED - handled by DB trigger
    });

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

      const reading = await llm.generate(prompt, `extended-${system}`);

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

    jobQueue.completeJob(job.id, results);
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

    const reading = await llm.generate(prompt, `synastry-${system}`);

    const results: Job['results'] = {
      readings: [],
      fullText: reading,
      chapters: [{
        name: `${system} Overlay`,
        text: reading,
      }],
    };

    jobQueue.completeJob(job.id, results);
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

      const p1Text = await llm.generate(p1Prompt, `nuclear_v2-${system}-p1`);
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

      const p2Text = await llm.generate(p2Prompt, `nuclear_v2-${system}-p2`);
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

      const overlayText = await llm.generate(overlayPrompt, `nuclear_v2-${system}-overlay`);
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

    const verdictText = await llm.generate(verdictPrompt, 'nuclear_v2-verdict');
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

    jobQueue.completeJob(job.id, results);
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
