/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { ephemerisIsolation } from '../services/ephemerisIsolation'; // Isolated process (crash-safe)
import { llm, llmPaid, type LLMProvider } from '../services/llm'; // Centralized LLM service
import { getProviderForSystem, type LLMProviderName } from '../config/llmProviders';
import { generateDramaticTitles } from '../services/titleGenerator'; // Dramatic title generation
import { buildVerdictPrompt } from '../prompts/structures/paidReadingPrompts';
import { SpiceLevel } from '../prompts/spice/levels';
import { WORD_COUNT_LIMITS } from '../prompts/config/wordCounts';
import { logLLMCost } from '../services/costTracking';
import { composePromptFromJobStartPayload } from '../promptEngine/fromJobPayload';
import { buildChartDataForSystem } from '../services/chartDataBuilder';
import {
  buildWesternChartDigestPrompt,
  compactWesternChartDataForDigest,
  validateWesternDigestAgainstChartData,
} from '../promptEngine/digests/westernDigest';

function clampSpice(level: number): SpiceLevel {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return clamped as SpiceLevel; // Cast validated number (1-10) to SpiceLevel
}

function countWords(text: string): number {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function cleanReadingText(raw: string): string {
  return String(raw || '')
    // Remove em-dashes and en-dashes
    .replace(/—/g, ', ').replace(/–/g, '-')
    // Remove markdown bold/italic asterisks
    .replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '')
    // Remove markdown headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown underscores for emphasis
    .replace(/___/g, '').replace(/__/g, '').replace(/(?<!\w)_(?!\w)/g, '')
    // Remove duplicate headlines (same line repeated)
    .replace(/^(.+)\n\1$/gm, '$1')
    // Remove section headers (short lines 2-5 words followed by blank line then text)
    // Common patterns: "The Attraction", "Core Identity", "THE SYNTHESIS", etc.
    .replace(/^(The |THE |CHAPTER |Section |Part )?[A-Z][A-Za-z\s]{5,40}\n\n/gm, '')
    // Clean up extra whitespace
    .replace(/\s+,/g, ',').replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tightenParagraphs(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return text;
  // Soul-memoir output has strict footer rules; don't restructure it here.
  if (/\bChart Signature\b/i.test(text)) return text;

  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const MIN_WORDS = 70; // Merge AI-ish short paragraphs into neighbors.
  const MAX_PARAS = 24; // Keep the essay feel: fewer, heavier paragraphs.
  const out: string[] = [];

  for (let i = 0; i < paras.length; i += 1) {
    const p = paras[i]!;
    const words = countWords(p);

    // Preserve the cold-open invocation as its own line.
    if (i === 0) {
      out.push(p);
      continue;
    }

    // Avoid merging into the invocation line; merge short paras into previous only after that.
    if (words < MIN_WORDS && out.length > 1) {
      out[out.length - 1] = `${out[out.length - 1]} ${p}`.replace(/\s+/g, ' ').trim();
      continue;
    }

    out.push(p);
  }

  // If the model still emits many short-ish blocks, merge the smallest ones until we hit a sane paragraph count.
  // Keep invocation as its own line, and keep the first full paragraph as a distinct start.
  while (out.length > MAX_PARAS) {
    let shortestIdx = -1;
    let shortestWords = Number.POSITIVE_INFINITY;
    for (let i = 2; i < out.length; i += 1) {
      const w = countWords(out[i]!);
      if (w < shortestWords) {
        shortestWords = w;
        shortestIdx = i;
      }
    }
    if (shortestIdx < 2) break;
    out[shortestIdx - 1] = `${out[shortestIdx - 1]} ${out[shortestIdx]}`.replace(/\s+/g, ' ').trim();
    out.splice(shortestIdx, 1);
  }

  return out.join('\n\n').trim();
}

function hasSecondPerson(text: string): boolean {
  return /\b(you|your|you're|yourself)\b/i.test(String(text || ''));
}

const FORBIDDEN_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'in_conclusion', re: /\b(in conclusion)\b/i },
  { id: 'ultimately_end_of_day', re: /\b(ultimately,? at the end of the day)\b/i },
  { id: 'heres_the_thing', re: /\b(here's the thing)\b/i },
  { id: 'this_is_not_just', re: /\b(this is not just)\b/i },
  { id: 'carries_the_signature', re: /\bcarries the signature\b/i },
  { id: 'gift_and_curse', re: /\bgift and curse\b/i },
  { id: 'fascinating_tension', re: /\bfascinating tension\b/i },
  { id: 'sun_represents', re: /\bThe Sun represents\b/i },
  { id: 'moon_governs', re: /\bThe Moon governs\b/i },
  { id: 'rising_is', re: /\bThe rising sign is\b/i },
  { id: 'astrologers_call', re: /\bAstrologers call\b/i },
  { id: 'house_is_def', re: /\bthe (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) house is\b/i },
  { id: 'ordinal_house_is_def', re: /\bthe (?:\d+)(?:st|nd|rd|th) house is\b/i },
];

function getForbiddenMatchIds(text: string): string[] {
  const t = String(text || '');
  const matches: string[] = [];
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(t)) matches.push(p.id);
  }
  return matches;
}

function hasForbiddenPhrases(text: string): boolean {
  return getForbiddenMatchIds(text).length > 0;
}

function hasBannedDetours(text: string): boolean {
  return /\b(office|workplace)\b/i.test(String(text || '')) ||
    /\bat work\b/i.test(String(text || '')) ||
    /\bteam meeting\b/i.test(String(text || '')) ||
    /\b(social justice|environmental sustainability|world healing)\b/i.test(String(text || ''));
}

function getComplianceIssues(text: string): string[] {
  const issues: string[] = [];
  if (hasSecondPerson(text)) issues.push('second_person');
  const forbidden = getForbiddenMatchIds(text);
  if (forbidden.length > 0) issues.push(`forbidden_phrase:${forbidden.slice(0, 6).join(',')}`);
  if (hasBannedDetours(text)) issues.push('banned_detour');
  return issues;
}

// LLM calls now use centralized service (src/services/llm.ts)
// Provider controlled by LLM_PROVIDER env var (deepseek | claude | openai)

export class TextWorker extends BaseWorker {
  constructor() {
    super({
      taskTypes: ['text_generation'],
      maxConcurrentTasks: 2,
    });
  }

  protected async processTask(task: JobTask): Promise<TaskResult> {
    if (!supabase) return { success: false, error: 'Supabase not configured' };

    // ===========================================================================
    // SWISS EPHEMERIS DIAGNOSTIC - Check health BEFORE attempting calculations
    // Using ISOLATED process to prevent crashes from killing main worker
    // ===========================================================================
    console.log('=== SWISS EPHEMERIS DIAGNOSTIC START ===');
    try {
      const healthCheck = await ephemerisIsolation.healthCheck();
      console.log('Swiss Ephemeris Health Check Result:', JSON.stringify(healthCheck, null, 2));

      if (healthCheck.status !== 'ok') {
        const errorMsg = `Swiss Ephemeris NOT ready: ${healthCheck.message}`;
        console.error('❌', errorMsg);
        return { success: false, error: errorMsg };
      }
      console.log('✅ Swiss Ephemeris is healthy, proceeding with task');
    } catch (healthError: any) {
      const errorMsg = `Swiss Ephemeris health check FAILED: ${healthError.message}`;
      console.error('❌', errorMsg);
      return { success: false, error: errorMsg };
    }
    console.log('=== SWISS EPHEMERIS DIAGNOSTIC END ===');

    const jobId = task.job_id;

    // Load job params
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, user_id, type, params')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return { success: false, error: `Failed to load job ${jobId}` };
    }

    if (job.type !== 'bundle_verdict' && job.type !== 'nuclear_v2' && job.type !== 'extended' && job.type !== 'synastry') {
      return { success: false, error: `TextWorker only supports bundle_verdict, synastry, and extended right now (got ${job.type})` };
    }

    const params: any = job.params || {};
    const person1 = params.person1;
    const person2 = params.person2; // Optional for single-person readings

    if (!person1) {
      return { success: false, error: 'Missing person1 in job.params' };
    }

    const style: 'production' | 'spicy_surreal' = params.style || 'spicy_surreal';
    const spiceLevel = clampSpice(params.relationshipPreferenceScale ?? params.relationshipIntensity ?? 5);

    // Task input schema (we keep it flexible)
    const docNum: number = Number(task.input?.docNum ?? task.sequence + 1);
    const docType: 'person1' | 'person2' | 'overlay' | 'verdict' | 'individual' =
      task.input?.docType ||
      (job.type === 'extended' ? 'individual' : (docNum === 16 ? 'verdict' : 'person1'));
    const system: string | null = task.input?.system ?? null;
    const title: string = task.input?.title || (docType === 'verdict' ? 'Final Verdict' : 'Untitled');

    const requestedSystems: string[] = Array.isArray(params.systems) ? params.systems : [];
    const systemsCount = requestedSystems.length > 0 ? requestedSystems.length : 1;
    const docsTotal =
      job.type === 'bundle_verdict' || job.type === 'nuclear_v2'
        ? 16
        : job.type === 'synastry'
          ? systemsCount * 3
          : systemsCount; // extended: 1 doc per system

    // Update progress: text generation started
    await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: {
        phase: 'text',
        message: `📝 ${title}...`,
        currentStep: `TEXT: Doc ${docNum}/${docsTotal}`,
        docsComplete: Number(task.input?.docsComplete || 0),
        docsTotal,
      },
    });

    // Swiss Ephemeris calculations (ISOLATED PROCESS - crash-safe)
    let p1Placements: any;
    let p2Placements: any;

    try {
      p1Placements = await ephemerisIsolation.computePlacements({
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        latitude: person1.latitude,
        longitude: person1.longitude,
        relationshipIntensity: spiceLevel,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
      });
    } catch (p1Error: any) {
      const errorMsg = `Person 1 ephemeris calculation failed: ${p1Error.message}`;
      console.error('❌', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Only compute person2 placements if person2 exists (for overlay readings)
    if (person2) {
      try {
        p2Placements = await ephemerisIsolation.computePlacements({
          birthDate: person2.birthDate,
          birthTime: person2.birthTime,
          timezone: person2.timezone,
          latitude: person2.latitude,
          longitude: person2.longitude,
          relationshipIntensity: spiceLevel,
          relationshipMode: 'sensual',
          primaryLanguage: 'en',
        });
      } catch (p2Error: any) {
        const errorMsg = `Person 2 ephemeris calculation failed: ${p2Error.message}`;
        console.error('❌', errorMsg);
        return { success: false, error: errorMsg };
      }
    } else {
      p2Placements = null; // No person2 for single-person readings
    }

    const p1BirthData = {
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: `${Number(person1.latitude).toFixed(2)}°N, ${Number(person1.longitude).toFixed(2)}°E`,
      timezone: person1.timezone,
    };

    const p2BirthData = person2 ? {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${Number(person2.latitude).toFixed(2)}°N, ${Number(person2.longitude).toFixed(2)}°E`,
      timezone: person2.timezone,
    } : null;

    // ===========================================================================
    // CRITICAL FIX: Build chart data based on docType!
    // - person1 docs: Only include person1's chart (no person2 data)
    // - person2 docs: Only include person2's chart (no person1 data)
    // - overlay/verdict docs: Include both charts
    // This prevents the LLM from writing about relationships in individual readings
    // ===========================================================================
    let chartData: string;
    
    if (docType === 'person1') {
      // Person1 individual reading - ONLY person1's chart
      chartData = buildChartDataForSystem(
        system || 'western',
        person1.name,
        p1Placements,
        null, // NO person2 data for individual readings!
        null,
        p1BirthData,
        null
      );
      console.log(`📊 [TextWorker] Building ${system} chart data for person1 doc ${docNum} (individual only)`);
    } else if (docType === 'person2') {
      // Person2 individual reading - ONLY person2's chart
      if (!person2 || !p2Placements || !p2BirthData) {
        throw new Error(`person2 doc requires person2 data, but it's missing for job ${jobId}`);
      }
      chartData = buildChartDataForSystem(
        system || 'western',
        person2.name,
        p2Placements,
        null, // NO person1 data for individual readings!
        null,
        p2BirthData,
        null
      );
      console.log(`📊 [TextWorker] Building ${system} chart data for person2 doc ${docNum} (individual only)`);
	    } else {
	      // Overlay/verdict/other - include both charts
	      chartData = buildChartDataForSystem(
	        system || 'western',
	        person1.name,
        p1Placements,
        person2?.name || null,
        p2Placements,
        p1BirthData,
        p2BirthData
	      );
	      console.log(`📊 [TextWorker] Building ${system} chart data for ${docType} doc ${docNum} (both people)`);
	    }

	    // Default: prompts see the full chart data. Some systems (Western) can be too heavy,
	    // so we optionally replace this with a curated digest (two-pass prompting).
	    let chartDataForPrompt = chartData;

	    let prompt = '';
	    let composedV2: ReturnType<typeof composePromptFromJobStartPayload> | null = null;
	    let label = `job:${jobId}:doc:${docNum}`;

    if (docType === 'verdict') {
      if (job.type !== 'bundle_verdict' && job.type !== 'nuclear_v2') {
        throw new Error(`Verdict docType is only valid for bundle_verdict jobs (got ${job.type})`);
      }
      // Existing verdict logic: summarize prior docs and ask LLM to synthesize.
      const { data: tasks, error: tasksErr } = await supabase
        .from('job_tasks')
        .select('sequence, output')
        .eq('job_id', jobId)
        .eq('task_type', 'text_generation')
        .eq('status', 'complete');

      if (tasksErr) {
        throw new Error(`Failed to fetch prior tasks for verdict: ${tasksErr.message}`);
      }

      const summaries = (tasks || [])
        .map((t: any) => t.output)
        .filter(Boolean)
        .filter((o: any) => o.docNum && o.docNum !== 16)
        .sort((a: any, b: any) => (a.docNum ?? 0) - (b.docNum ?? 0))
        .map((o: any) => `${o.title}: ${String(o.excerpt || '').slice(0, 600)}...`)
        .join('\n\n');

      prompt = buildVerdictPrompt({
        person1Name: person1.name,
        person2Name: person2.name,
        allReadingsSummary: summaries || '[No summaries available]',
        spiceLevel,
        style,
      });
      label += ':verdict';

	    } else {
	      if (!system) {
	        throw new Error(`Missing system for non-verdict doc ${docNum} (docType=${docType})`);
	      }

      if (docType === 'overlay' && !person2) {
        throw new Error(`Overlay doc requires person2, but person2 is missing for job ${jobId}`);
      }

	      if (docType === 'person2' && !person2) {
	        throw new Error(`person2 doc requires person2, but person2 is missing for job ${jobId}`);
	      }

	      // Two-pass prompting (Western only): build a compact digest first, then write the long essay from the digest.
	      // This prevents Sonnet from being overwhelmed by huge raw chart data blocks.
	      if (system === 'western' && docType !== 'overlay' && getProviderForSystem(system) === 'claude') {
	        const subject = docType === 'person2' ? person2 : person1;
	        if (subject?.name) {
	          const digestSource = compactWesternChartDataForDigest(chartData);
	          const digestPrompt = buildWesternChartDigestPrompt({
	            personName: subject.name,
	            chartData: digestSource,
	          });

	          const MAX_DIGEST_ATTEMPTS = 2;
	          for (let attempt = 1; attempt <= MAX_DIGEST_ATTEMPTS; attempt += 1) {
	            const digestLabel = `${label}:westernDigest:${docType}:attempt:${attempt}`;
	            console.log(`🧠 [TextWorker] Western digest pass ${attempt}/${MAX_DIGEST_ATTEMPTS}...`);

	            const digestRaw = await llmPaid.generateStreaming(digestPrompt, digestLabel, {
	              maxTokens: 4096,
	              temperature: 0.25 + (attempt - 1) * 0.05,
	              maxRetries: 3,
	            });

	            const digestUsage = llmPaid.getLastUsage();
	            if (digestUsage) {
	              await logLLMCost(
	                jobId,
	                task.id,
	                {
	                  provider: digestUsage.provider,
	                  inputTokens: digestUsage.usage.inputTokens,
	                  outputTokens: digestUsage.usage.outputTokens,
	                },
	                `text_western_digest_${docType}_${attempt}`
	              );
	            }

	            const digest = String(digestRaw || '').trim();
	            const validation = validateWesternDigestAgainstChartData({ digest, chartData });
	            if (!validation.ok) {
	              console.warn(`⚠️ [TextWorker] Western digest validation failed: ${validation.reason || 'unknown'}`);
	              continue;
	            }

	            chartDataForPrompt = [
	              'CHART DATA (CURATED DIGEST; authoritative subset)',
	              digest,
	            ].join('\n\n');

	            console.log(`✅ [TextWorker] Western digest accepted (${validation.evidenceLines.length} evidence lines).`);
	            break;
	          }
	        }
	      }

	      // V2 prompt engine (MD prompt layers) is the source of truth for all systems.
	      // Map docType into the prompt-engine job type.
	      const promptPayload: any = {
	        type: docType === 'overlay' ? 'synastry' : 'extended',
	        systems: [system],
	        person1: docType === 'person2' ? person2 : person1,
	        ...(docType === 'overlay' ? { person2 } : {}),
	        chartData: chartDataForPrompt,
	        relationshipPreferenceScale: spiceLevel,
	        personalContext: params.personalContext,
	        relationshipContext: params.relationshipContext,
	        outputLanguage: params.outputLanguage,
        outputLengthContract: params.outputLengthContract,
        promptLayerDirective: params.promptLayerDirective,
      };

      const composed = composePromptFromJobStartPayload(promptPayload);
      composedV2 = composed;
      prompt = composed.prompt;
      label += `:v2prompt:${docType}:${system}`;

      console.log(
        `🧩 [PromptEngine] style=${composed.diagnostics.styleLayerId} systems=${composed.diagnostics.systemLayerIds
          .map((s) => `${s.system}:${s.layerId}`)
          .join(',')} chars=${composed.diagnostics.totalChars}`
      );
    }

    // DEBUG: Log prompt for Vedic system to verify instructions are included
    if (system === 'vedic') {
      console.log('🔍 [Vedic Debug] System:', system);
      console.log('🔍 [Vedic Debug] Chart data length:', chartData.length);
      console.log('🔍 [Vedic Debug] Chart data preview:', chartData.substring(0, 200));
      console.log('🔍 [Vedic Debug] Prompt includes "VEDIC":', prompt.includes('VEDIC'));
      console.log('🔍 [Vedic Debug] Prompt includes "Nakshatra":', prompt.includes('Nakshatra'));
      console.log('🔍 [Vedic Debug] Prompt includes "Sidereal":', prompt.includes('Sidereal'));
      console.log('🔍 [Vedic Debug] Prompt includes "Jyotish":', prompt.includes('Jyotish'));
      console.log('🔍 [Vedic Debug] Prompt length:', prompt.length);
    }

    // Use centralized LLM service with per-system provider config
    // Config: src/config/llmProviders.ts (Claude for most, OpenAI for Kabbalah)
    const configuredProvider = getProviderForSystem(system || 'western');
    console.log(`🔧 System "${system}" → Provider: ${configuredProvider}`);
    
    let text: string;
    let llmInstance: typeof llm | typeof llmPaid;
    
    // Log prompt length for debugging word count issues
    const llmUserMessage = composedV2?.userMessage || prompt;
    const llmSystemPrompt = composedV2?.systemPrompt || undefined;
    const promptLength = llmUserMessage.length;
    const promptWordCount = llmUserMessage.split(/\s+/).filter(Boolean).length;
    console.log(`📝 [TextWorker] Prompt stats: ${promptLength} chars, ~${promptWordCount} words`);
    console.log(`📝 [TextWorker] systemPrompt: ${llmSystemPrompt ? `${llmSystemPrompt.length} chars` : 'none'}`);
    console.log(`📝 [TextWorker] Prompt preview (first 500 chars): ${llmUserMessage.substring(0, 500)}`);
    
    if (configuredProvider === 'claude') {
      // Use Claude Sonnet 4 via llmPaid (unhinged, no censorship)
      // maxTokens: 16384 = increased to support 4500+ word outputs
      // temperature: 0.8 = matching b4 Cowork version
      llmInstance = llmPaid;
      // Use streaming to prevent mid-response connection resets on long outputs.
      text = await llmPaid.generateStreaming(llmUserMessage, label, {
        maxTokens: 16384,
        temperature: 0.8,
        maxRetries: 3,
        systemPrompt: llmSystemPrompt,
      });
    } else {
      // Use DeepSeek (default) or OpenAI via llm with provider override
      // maxTokens: 12000 = increased to support 4500+ word outputs
      llmInstance = llm;
      text = await llm.generate(llmUserMessage, label, { 
        maxTokens: 12000, 
        temperature: 0.8,
        provider: configuredProvider as LLMProvider,
        systemPrompt: llmSystemPrompt,
      });
    }
    
    // 💰 LOG COST for this LLM call
    const usageData = llmInstance.getLastUsage();
    if (usageData) {
      await logLLMCost(
        jobId,
        task.id,
        {
          provider: usageData.provider,
          inputTokens: usageData.usage.inputTokens,
          outputTokens: usageData.usage.outputTokens,
        },
        `text_${system || 'verdict'}_${docType}`
      );
    }
    
    // Post-process: Clean LLM output for spoken audio
    text = tightenParagraphs(cleanReadingText(text));

    // Length backstop:
    // Prompts already ask for ~4500 words, but some models stop early.
    // We enforce a hard floor and auto-continue in a few passes instead of failing the job.
    // Enforcement floor: keep it long-form, but don't force unnecessary expansion passes.
    // The prompt contract already targets WORD_COUNT_LIMITS.min-max.
    const HARD_FLOOR_WORDS = WORD_COUNT_LIMITS.min; // reliably >25 min narration for our voice settings.
    const MAX_EXPANSION_PASSES = 3;

    async function expandToHardFloor(initial: string): Promise<string> {
      let out = initial;

      for (let pass = 1; pass <= MAX_EXPANSION_PASSES; pass += 1) {
        const currentWords = countWords(out);
        if (currentWords >= HARD_FLOOR_WORDS) break;

        const missing = HARD_FLOOR_WORDS - currentWords;
        const minAdditional = Math.max(300, missing + 250); // Buffer avoids borderline failures.
        const tail = out.length > 9000 ? out.slice(-9000) : out;
        const chartBlock = chartDataForPrompt
          ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartDataForPrompt}`
          : '';

        console.warn(
          `🧱 [TextWorker] Output too short (${currentWords} < ${HARD_FLOOR_WORDS}). Expanding pass ${pass}/${MAX_EXPANSION_PASSES} (+${minAdditional} words)...`
        );

        const expansionPrompt = [
          'You are continuing an existing long-form astrology reading that was cut short.',
          '',
          'RULES:',
          '- Continue seamlessly from the text below.',
          '- Do not repeat, summarize, or restart the reading.',
          '- Keep the same voice, intensity, and style.',
          '- No bullet points. No lists. No markdown. Continuous prose only.',
          '- Never address the reader. No second-person pronouns (you/your/yourself).',
          '- Do NOT introduce any new chart factors (new planet/sign/house/aspect/transit/profection) beyond what is already present in the text or explicitly listed in CHART DATA.',
          '- If you mention any placement or transit, it must match CHART DATA exactly.',
          '- Do not drift into astrology lecture mode. Avoid definitional frames like:',
          '  "The Sun represents...", "The Moon governs...", "The rising sign is...", "Astrologers call...", "the ninth house is..."',
          '- Avoid template openers like: "carries the signature of..."',
          `- Write at least ${minAdditional} NEW words before stopping.`,
          '- Do not mention word counts.',
          chartBlock,
          '',
          'TEXT TO CONTINUE FROM (do not repeat):',
          tail,
          '',
          'CONTINUE NOW:',
        ].join('\n');

        const expansionLabel = `${label}:expand:${pass}`;
        let chunk: string;
        if (configuredProvider === 'claude') {
          chunk = await llmPaid.generateStreaming(expansionPrompt, expansionLabel, {
            maxTokens: 8192,
            temperature: 0.8,
            maxRetries: 3,
          });
        } else {
          chunk = await llm.generate(expansionPrompt, expansionLabel, {
            maxTokens: 8192,
            temperature: 0.8,
            provider: configuredProvider as LLMProvider,
          });
        }

        const expUsageData = llmInstance.getLastUsage();
        if (expUsageData) {
          await logLLMCost(
            jobId,
            task.id,
            {
              provider: expUsageData.provider,
              inputTokens: expUsageData.usage.inputTokens,
              outputTokens: expUsageData.usage.outputTokens,
            },
            `text_expand_${system || 'verdict'}_${docType}_${pass}`
          );
        }

        chunk = tightenParagraphs(cleanReadingText(chunk));
        out = `${out.trim()}\n\n${chunk.trim()}`.trim();
      }

      return out;
    }

    let wordCount = countWords(text);

    if (wordCount < HARD_FLOOR_WORDS) {
      text = await expandToHardFloor(text);
      wordCount = countWords(text);
    }

    if (wordCount < HARD_FLOOR_WORDS) {
      console.error(`\n${'═'.repeat(70)}`);
      console.error(`🚨 TEXT TOO SHORT - REJECTING`);
      console.error(`${'═'.repeat(70)}`);
      console.error(`Required: ${HARD_FLOOR_WORDS} words minimum`);
      console.error(`Received: ${wordCount} words`);
      console.error(`Shortage: ${HARD_FLOOR_WORDS - wordCount} words missing`);
      console.error(`${'═'.repeat(70)}\n`);
      throw new Error(`LLM returned too little text: ${wordCount} words (minimum ${HARD_FLOOR_WORDS} required)`);
    }

    console.log(`✅ Word count validation passed: ${wordCount} words (minimum ${HARD_FLOOR_WORDS})`);

    // Extract headline from first line of text
    const lines = text.split('\n').filter(line => line.trim());
    const headline = lines[0]?.trim() || '';
    console.log(`📰 Extracted headline: "${headline}"`);

    const excerpt = text.slice(0, 600);

    // Generate dramatic titles (separate LLM call for evocative titles)
    const personName = docType === 'person2' && person2?.name ? person2.name : person1?.name || 'User';
    console.log(`🎭 Generating dramatic titles for ${personName}/${system}...`);
    
    const dramaticTitles = await generateDramaticTitles({
      system: system || 'western',
      personName,
      textExcerpt: excerpt,
      docType: docType as 'person1' | 'person2' | 'overlay' | 'verdict',
      spiceLevel,
    });
    
    console.log(`✅ Dramatic titles generated:`);
    console.log(`   📖 Reading: "${dramaticTitles.readingTitle}"`);
    console.log(`   🎵 Song: "${dramaticTitles.songTitle}"`);

    // Match BaseWorker storage path logic for output (so SQL trigger can enqueue audio tasks)
    const artifactType = 'text' as const;
    const extension = 'txt';
    const textArtifactPath = `${job.user_id}/${jobId}/${artifactType}/${task.id}.${extension}`;

    return {
      success: true,
      output: {
        docNum,
        docType,
        system: system || null,
        title: title || (system ? `${String(system)} - ${docType}` : 'Final Verdict'),
        wordCount,
        excerpt,
        textArtifactPath,
        headline, // Add headline to output
      },
      artifacts: [
        {
          type: 'text',
          buffer: Buffer.from(text, 'utf-8'),
          contentType: 'text/plain; charset=utf-8',
          metadata: {
            jobId,
            docNum,
            docType,
            system: system || null,
            title,
            headline, // LLM-generated headline from first line
            readingTitle: dramaticTitles.readingTitle, // Dramatic title for reading
            songTitle: dramaticTitles.songTitle, // Dramatic title for song
            wordCount,
          },
        },
      ],
    };
  }
}

if (require.main === module) {
  const worker = new TextWorker();
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());

  worker.start().catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
  });
}
