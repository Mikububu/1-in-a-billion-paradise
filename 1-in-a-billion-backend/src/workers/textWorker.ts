/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { ephemerisIsolation } from '../services/ephemerisIsolation'; // Isolated process (crash-safe)
import { llm } from '../services/llm'; // Centralized LLM service
import {
  SYSTEMS as NUCLEAR_V2_SYSTEMS,
  SYSTEM_DISPLAY_NAMES as NUCLEAR_V2_SYSTEM_NAMES,
  buildPersonPrompt,
  buildOverlayPrompt as buildNuclearV2OverlayPrompt,
  buildVerdictPrompt,
} from '../prompts/structures/nuclearV2';
import { buildIndividualPrompt } from '../prompts';
import { SpiceLevel } from '../prompts/spice/levels';

function clampSpice(level: number): SpiceLevel {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return clamped as SpiceLevel; // Cast validated number (1-10) to SpiceLevel
}

/**
 * Build chart data string SPECIFIC to the system being analyzed.
 * 
 * CRITICAL: Each system needs its own relevant data, not Western data for everything!
 * - Western: Tropical zodiac positions (Sun, Moon, Rising)
 * - Vedic: Sidereal positions (~23° offset), Nakshatras, Dashas
 * - Human Design: Based on birth time, gates, centers, channels
 * - Gene Keys: Based on I Ching gates from Human Design
 * - Kabbalah: Life path numbers, Sephirot positions
 */
function buildChartDataForSystem(
  system: string,
  person1Name: string,
  p1Placements: any,
  person2Name: string,
  p2Placements: any,
  p1BirthData: { birthDate: string; birthTime: string },
  p2BirthData: { birthDate: string; birthTime: string }
): string {
  const formatDegree = (d: any) => (d ? `${d.degree}° ${d.minute}'` : '');

  // Calculate approximate sidereal positions (Lahiri ayanamsa ~23°50')
  const AYANAMSA = 23.85; // Lahiri ayanamsa for current era
  const toSidereal = (tropicalDegree: number) => {
    const sidereal = tropicalDegree - AYANAMSA;
    return sidereal < 0 ? sidereal + 360 : sidereal;
  };

  const getZodiacSign = (degree: number): string => {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    return signs[Math.floor(degree / 30) % 12];
  };

  const getNakshatra = (degree: number): string => {
    const nakshatras = [
      'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
      'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
      'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
      'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha',
      'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];
    return nakshatras[Math.floor(degree / 13.333) % 27];
  };

  // Calculate Human Design gates from Sun position
  const getHDGate = (degree: number): number => {
    // Human Design uses a specific mapping of degrees to I Ching gates
    const gateMap = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
    return gateMap[Math.floor(degree / 5.625) % 64];
  };

  // Calculate Life Path number for Kabbalah
  const getLifePath = (birthDate: string): number => {
    const digits = birthDate.replace(/\D/g, '').split('').map(Number);
    let sum = digits.reduce((a, b) => a + b, 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = sum.toString().split('').map(Number).reduce((a, b) => a + b, 0);
    }
    return sum;
  };

  // Extract tropical degrees (estimate from sign if exact degree not available)
  const signToDegree: Record<string, number> = {
    'Aries': 15, 'Taurus': 45, 'Gemini': 75, 'Cancer': 105, 'Leo': 135, 'Virgo': 165,
    'Libra': 195, 'Scorpio': 225, 'Sagittarius': 255, 'Capricorn': 285, 'Aquarius': 315, 'Pisces': 345
  };

  const p1SunDeg = p1Placements.sunDegree?.degree || signToDegree[p1Placements.sunSign] || 0;
  const p1MoonDeg = p1Placements.moonDegree?.degree || signToDegree[p1Placements.moonSign] || 0;
  const p2SunDeg = p2Placements.sunDegree?.degree || signToDegree[p2Placements.sunSign] || 0;
  const p2MoonDeg = p2Placements.moonDegree?.degree || signToDegree[p2Placements.moonSign] || 0;

  switch (system) {
    case 'western':
      return `${person1Name.toUpperCase()} WESTERN (TROPICAL) CHART:
- Sun: ${p1Placements.sunSign} ${formatDegree(p1Placements.sunDegree)}
- Moon: ${p1Placements.moonSign} ${formatDegree(p1Placements.moonDegree)}
- Rising: ${p1Placements.risingSign} ${formatDegree(p1Placements.ascendantDegree)}

${person2Name.toUpperCase()} WESTERN (TROPICAL) CHART:
- Sun: ${p2Placements.sunSign} ${formatDegree(p2Placements.sunDegree)}
- Moon: ${p2Placements.moonSign} ${formatDegree(p2Placements.moonDegree)}
- Rising: ${p2Placements.risingSign} ${formatDegree(p2Placements.ascendantDegree)}`;

    case 'vedic':
      const p1SunSidereal = toSidereal(p1SunDeg);
      const p1MoonSidereal = toSidereal(p1MoonDeg);
      const p2SunSidereal = toSidereal(p2SunDeg);
      const p2MoonSidereal = toSidereal(p2MoonDeg);

      return `${person1Name.toUpperCase()} VEDIC (SIDEREAL/JYOTISH) CHART:
- Sun (Surya): ${getZodiacSign(p1SunSidereal)} ${Math.floor(p1SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p1SunSidereal)}
- Moon (Chandra): ${getZodiacSign(p1MoonSidereal)} ${Math.floor(p1MoonSidereal % 30)}° - Nakshatra: ${getNakshatra(p1MoonSidereal)}
- Moon Nakshatra Lord: ${['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p1MoonSidereal / 13.333) % 9]}

${person2Name.toUpperCase()} VEDIC (SIDEREAL/JYOTISH) CHART:
- Sun (Surya): ${getZodiacSign(p2SunSidereal)} ${Math.floor(p2SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p2SunSidereal)}
- Moon (Chandra): ${getZodiacSign(p2MoonSidereal)} ${Math.floor(p2MoonSidereal % 30)}° - Nakshatra: ${getNakshatra(p2MoonSidereal)}
- Moon Nakshatra Lord: ${['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p2MoonSidereal / 13.333) % 9]}

NOTE: Vedic astrology uses the sidereal zodiac (~24° offset from tropical). Focus on Nakshatras, planetary periods (Dashas), and Vedic house system.`;

    case 'human_design':
      const p1SunGate = getHDGate(p1SunDeg);
      const p1EarthGate = getHDGate((p1SunDeg + 180) % 360);
      const p2SunGate = getHDGate(p2SunDeg);
      const p2EarthGate = getHDGate((p2SunDeg + 180) % 360);

      return `${person1Name.toUpperCase()} HUMAN DESIGN:
- Conscious Sun Gate: ${p1SunGate}
- Conscious Earth Gate: ${p1EarthGate}
- Design Sun Gate (88° before birth): ${getHDGate((p1SunDeg - 88 + 360) % 360)}
- Born: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}

${person2Name.toUpperCase()} HUMAN DESIGN:
- Conscious Sun Gate: ${p2SunGate}
- Conscious Earth Gate: ${p2EarthGate}
- Design Sun Gate (88° before birth): ${getHDGate((p2SunDeg - 88 + 360) % 360)}
- Born: ${p2BirthData.birthDate} at ${p2BirthData.birthTime}

NOTE: Human Design combines I Ching, Kabbalah, Hindu-Brahmin chakras, and astrology. Focus on Type, Strategy, Authority, and Gate activations.`;

    case 'gene_keys':
      const p1GK = getHDGate(p1SunDeg);
      const p2GK = getHDGate(p2SunDeg);

      return `${person1Name.toUpperCase()} GENE KEYS:
- Life's Work (Conscious Sun): Gene Key ${p1GK}
- Evolution (Conscious Earth): Gene Key ${getHDGate((p1SunDeg + 180) % 360)}
- Radiance (Conscious South Node): Gene Key ${getHDGate((p1SunDeg + 90) % 360)}
- Purpose (Conscious North Node): Gene Key ${getHDGate((p1SunDeg + 270) % 360)}

${person2Name.toUpperCase()} GENE KEYS:
- Life's Work (Conscious Sun): Gene Key ${p2GK}
- Evolution (Conscious Earth): Gene Key ${getHDGate((p2SunDeg + 180) % 360)}
- Radiance (Conscious South Node): Gene Key ${getHDGate((p2SunDeg + 90) % 360)}
- Purpose (Conscious North Node): Gene Key ${getHDGate((p2SunDeg + 270) % 360)}

NOTE: Gene Keys explores the Shadow, Gift, and Siddhi of each key. Focus on the journey from Shadow to Gift to Siddhi.`;

    case 'kabbalah':
      const p1LP = getLifePath(p1BirthData.birthDate);
      const p2LP = getLifePath(p2BirthData.birthDate);
      const sephirot = ['', 'Kether (Crown)', 'Chokmah (Wisdom)', 'Binah (Understanding)',
        'Chesed (Mercy)', 'Geburah (Severity)', 'Tiphareth (Beauty)',
        'Netzach (Victory)', 'Hod (Glory)', 'Yesod (Foundation)',
        'Malkuth (Kingdom)', 'Kether-Chokmah', 'Binah-Chesed'];

      return `${person1Name.toUpperCase()} KABBALAH:
- Life Path Number: ${p1LP} - ${sephirot[p1LP] || 'Master Number'}
- Birth Day Number: ${parseInt(p1BirthData.birthDate.split('-')[2] || '1')}
- Soul Urge: Derived from vowels in name

${person2Name.toUpperCase()} KABBALAH:
- Life Path Number: ${p2LP} - ${sephirot[p2LP] || 'Master Number'}
- Birth Day Number: ${parseInt(p2BirthData.birthDate.split('-')[2] || '1')}
- Soul Urge: Derived from vowels in name

NOTE: Kabbalah focuses on the Tree of Life (Sephirot), paths between spheres, and the soul's journey. Focus on how their Life Paths interact on the Tree.`;

    default:
      return `Birth Data for ${person1Name}: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}
Birth Data for ${person2Name}: ${p2BirthData.birthDate} at ${p2BirthData.birthTime}`;
  }
}

// Legacy function - kept for backwards compatibility
function buildChartDataString(
  person1Name: string,
  p1Placements: any,
  person2Name: string,
  p2Placements: any
): string {
  return buildChartDataForSystem('western', person1Name, p1Placements, person2Name, p2Placements,
    { birthDate: '', birthTime: '' }, { birthDate: '', birthTime: '' });
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

    // ═══════════════════════════════════════════════════════════════════════════
    // SWISS EPHEMERIS DIAGNOSTIC - Check health BEFORE attempting calculations
    // Using ISOLATED process to prevent crashes from killing main worker
    // ═══════════════════════════════════════════════════════════════════════════
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

    if (job.type !== 'nuclear_v2' && job.type !== 'extended') {
      return { success: false, error: `TextWorker only supports nuclear_v2 and extended right now (got ${job.type})` };
    }

    const params: any = job.params || {};
    const person1 = params.person1;
    const person2 = params.person2; // Optional for single-person readings

    if (!person1) {
      return { success: false, error: 'Missing person1 in job.params' };
    }

    const style: 'production' | 'spicy_surreal' = params.style || 'spicy_surreal';
    const spiceLevel = clampSpice(params.relationshipIntensity || 5);

    // Task input schema (we keep it flexible)
    const docNum: number = Number(task.input?.docNum ?? task.sequence + 1);
    const docType: 'person1' | 'person2' | 'overlay' | 'verdict' = task.input?.docType || (docNum === 16 ? 'verdict' : 'person1');
    const system: string | null = task.input?.system ?? null;
    const title: string = task.input?.title || (docType === 'verdict' ? 'Final Verdict' : 'Untitled');

    // Update progress: text generation started
    await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: {
        phase: 'text',
        message: `📝 ${title}...`,
        currentStep: `TEXT: Doc ${docNum}/16`,
        docsComplete: Number(task.input?.docsComplete || 0),
        docsTotal: 16,
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
    };

    const p2BirthData = {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${Number(person2.latitude).toFixed(2)}°N, ${Number(person2.longitude).toFixed(2)}°E`,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL FIX: Use SYSTEM-SPECIFIC chart data, not generic Western data!
    // Each system needs its own language: Vedic=Nakshatras, HD=Gates, GK=Gene Keys, etc.
    // ═══════════════════════════════════════════════════════════════════════════
    const chartData = buildChartDataForSystem(
      system || 'western',  // Use the actual system from task input
      person1.name,
      p1Placements,
      person2.name,
      p2Placements,
      p1BirthData,
      p2BirthData
    );

    console.log(`📊 [TextWorker] Building ${system} chart data for doc ${docNum} (not Western unless system=western)`);

    let prompt = '';
    let label = `job:${jobId}:doc:${docNum}`;

    if (docType === 'verdict') {
      // Build summary from completed text tasks
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
      if (!system || !(NUCLEAR_V2_SYSTEMS as readonly string[]).includes(system)) {
        throw new Error(`Invalid or missing system for doc ${docNum}: ${system}`);
      }

      if (docType === 'overlay') {
        prompt = buildNuclearV2OverlayPrompt({
          system: system as any,
          person1Name: person1.name,
          person2Name: person2.name,
          chartData,
          spiceLevel,
          style,
          relationshipContext: params.relationshipContext, // Optional context for interpretive emphasis
        });
        label += `:overlay:${system}`;
      } else if (docType === 'person1') {
        prompt = buildPersonPrompt({
          system: system as any,
          personName: person1.name,
          personData: p1BirthData,
          chartData,
          spiceLevel,
          style,
          personalContext: params.personalContext, // Pass through for individual reading personalization
        });
        label += `:p1:${system}`;
      } else if (docType === 'person2') {
        prompt = buildPersonPrompt({
          system: system as any,
          personName: person2.name,
          personData: p2BirthData,
          chartData,
          spiceLevel,
          style,
          personalContext: params.personalContext, // Pass through for individual reading personalization
        });
        label += `:p2:${system}`;
      } else if (docType === 'individual') {
        prompt = buildIndividualPrompt({
          type: 'individual',
          style,
          spiceLevel: spiceLevel as SpiceLevel, // Cast number to SpiceLevel union type
          system: system as any,
          voiceMode: 'other',
          person: p1BirthData as any, // Cast to match PersonData
          chartData: { western: chartData } as any, // Wrap string in ChartData object
          personalContext: params.personalContext, // Pass through for individual reading personalization
        });
        // Update name in person data for prompt
        (prompt as any).personName = person1.name;
        label += `:individual:${system}`;
      } else {
        throw new Error(`Unknown docType: ${docType}`);
      }
    }

    // Use centralized LLM service (provider set by LLM_PROVIDER env)
    const text = await llm.generate(prompt, label, { maxTokens: 8192, temperature: 0.8 });
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount < 200) {
      throw new Error(`LLM returned too little text (${wordCount} words)`);
    }

    const excerpt = text.slice(0, 600);

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
