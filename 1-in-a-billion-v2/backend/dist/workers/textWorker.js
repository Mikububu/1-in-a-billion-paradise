"use strict";
/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextWorker = void 0;
const baseWorker_1 = require("./baseWorker");
const supabaseClient_1 = require("../services/supabaseClient");
const ephemerisIsolation_1 = require("../services/ephemerisIsolation"); // Isolated process (crash-safe)
const llm_1 = require("../services/llm"); // Centralized LLM service
const llmProviders_1 = require("../config/llmProviders");
const titleGenerator_1 = require("../services/titleGenerator"); // Dramatic title generation
const paidReadingPrompts_1 = require("../prompts/structures/paidReadingPrompts");
const styles_1 = require("../prompts/styles");
const chartProvocations_1 = require("../prompts/chartProvocations");
const compatibilityScoring_1 = require("../scripts/shared/compatibilityScoring");
const wordCounts_1 = require("../prompts/config/wordCounts");
const languages_1 = require("../config/languages");
const costTracking_1 = require("../services/costTracking");
const fromJobPayload_1 = require("../promptEngine/fromJobPayload");
const chartDataBuilder_1 = require("../services/chartDataBuilder");
const chartReferencePage_1 = require("../services/chartReferencePage");
const westernTrigger_1 = require("../promptEngine/triggerEngine/westernTrigger");
const vedicTrigger_1 = require("../promptEngine/triggerEngine/vedicTrigger");
const humanDesignTrigger_1 = require("../promptEngine/triggerEngine/humanDesignTrigger");
const geneKeysTrigger_1 = require("../promptEngine/triggerEngine/geneKeysTrigger");
const kabbalahTrigger_1 = require("../promptEngine/triggerEngine/kabbalahTrigger");
const overlayTrigger_1 = require("../promptEngine/triggerEngine/overlayTrigger");
function clampSpice(level) {
    const clamped = Math.min(10, Math.max(1, Math.round(level)));
    return clamped; // Cast validated number (1-10) to SpiceLevel
}
/**
 * CJK-aware word counter.
 * For CJK characters (Japanese, Chinese, Korean) there are no spaces between words,
 * so we count each CJK character as ~1 word-equivalent.
 * For mixed text: count space-delimited tokens + CJK characters separately.
 */
const CJK_RANGE = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]/g;
function countWords(text) {
    const s = String(text || '');
    // Count CJK characters (each ≈ 1 word)
    const cjkMatches = s.match(CJK_RANGE);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    // Remove CJK characters, then count remaining space-delimited tokens
    const nonCjk = s.replace(CJK_RANGE, ' ');
    const spaceWords = nonCjk.split(/\s+/).filter(Boolean).length;
    return spaceWords + cjkCount;
}
/** Languages where word counting should use CJK rules and reduced floors */
function isCJKLanguage(lang) {
    return ['ja', 'zh', 'ko'].includes(lang || '');
}
function isHeadlineLine(line) {
    const text = String(line || '').trim();
    if (!text)
        return false;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3 || words.length > 14)
        return false;
    if (/[.!?;:]$/.test(text))
        return false;
    return /^[A-Z][A-Za-z0-9,'"\-\s]+$/.test(text);
}
function findVoiceAnchorLeak(text) {
    const body = String(text || '').toLowerCase();
    const fingerprints = [
        { id: 'cathedral_pray_in', re: /\bcathedral\s+they\s+want\s+to\s+pray\s+in\b/i },
        { id: 'animal_behind_closed_doors', re: /\banimal\s+that\s+appears\s+behind\s+closed\s+doors\b/i },
        { id: 'puts_pronoun_mouth_there', re: /\bputs\s+(?:his|her|its)\s+mouth\s+there\b/i },
        { id: 'precision_love_hiding', re: /\bprecision\s+is\s+a\s+form\s+of\s+love\s+and\s+a\s+form\s+of\s+hiding\b/i },
    ];
    for (const fp of fingerprints) {
        if (fp.re.test(body))
            return fp.id;
    }
    return null;
}
function normalizePipeTables(text) {
    const lines = String(text || '').split('\n');
    const out = [];
    let i = 0;
    const parseRow = (line) => {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        return trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    };
    const isSeparatorCell = (cell) => /^:?-{3,}:?$/.test(cell);
    while (i < lines.length) {
        const line = lines[i] || '';
        if (!line.trim().startsWith('|')) {
            out.push(line);
            i += 1;
            continue;
        }
        const block = [];
        while (i < lines.length && (lines[i] || '').trim().startsWith('|')) {
            block.push(lines[i] || '');
            i += 1;
        }
        const converted = [];
        for (let r = 0; r < block.length; r += 1) {
            const cells = parseRow(block[r] || '');
            if (cells.length === 0)
                continue;
            if (cells.every(isSeparatorCell))
                continue;
            if (r === 0 &&
                cells.length >= 2 &&
                /dimension/i.test(cells[0] || '') &&
                /score/i.test(cells[1] || '')) {
                continue;
            }
            if (cells.length === 1) {
                converted.push(cells[0] || '');
                continue;
            }
            const left = cells[0] || '';
            const right = cells[1] || '';
            const rest = cells.slice(2).join(' | ');
            converted.push(rest ? `${left}: ${right} - ${rest}` : `${left}: ${right}`);
        }
        if (converted.length > 0)
            out.push(...converted);
    }
    return out.join('\n');
}
function cleanReadingText(raw, options) {
    let out = String(raw || '')
        .replace(/^\s*\|---.*\|\s*$/gim, '')
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
        // Remove expansion seam marker if model inserts it.
        .replace(/^\s*The Reading Continues\s*$/gim, '');
    out = normalizePipeTables(out);
    if (!options?.preserveSurrealHeadlines) {
        // Remove section headers (short lines 2-5 words followed by blank line then text)
        // Common patterns: "The Attraction", "Core Identity", "THE SYNTHESIS", etc.
        out = out.replace(/^(The |THE |CHAPTER |Section |Part )?[A-Z][A-Za-z\s]{5,40}\n\n/gm, '');
    }
    return out
        // Clean up extra whitespace
        .replace(/\s+,/g, ',').replace(/\n{3,}/g, '\n\n')
        .trim();
}
function tightenParagraphs(raw, options) {
    const text = String(raw || '').trim();
    if (!text)
        return text;
    const paras = text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const MIN_WORDS = 70; // Merge AI-ish short paragraphs into neighbors.
    const MAX_PARAS = 24; // Keep the essay feel: fewer, heavier paragraphs.
    const out = [];
    for (let i = 0; i < paras.length; i += 1) {
        const p = paras[i];
        const words = countWords(p);
        const isSurrealHeadline = options?.preserveSurrealHeadlines && isHeadlineLine(p);
        // Preserve the cold-open invocation as its own line.
        if (i === 0) {
            out.push(p);
            continue;
        }
        if (isSurrealHeadline) {
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
            if (options?.preserveSurrealHeadlines && isHeadlineLine(out[i]))
                continue;
            const w = countWords(out[i]);
            if (w < shortestWords) {
                shortestWords = w;
                shortestIdx = i;
            }
        }
        if (shortestIdx < 2)
            break;
        out[shortestIdx - 1] = `${out[shortestIdx - 1]} ${out[shortestIdx]}`.replace(/\s+/g, ' ').trim();
        out.splice(shortestIdx, 1);
    }
    return out.join('\n\n').trim();
}
function hasSecondPerson(text) {
    const body = String(text || '');
    // Allow quoted dialogue to contain "you" while enforcing narrator voice outside quotes.
    const withoutQuotedDialogue = body.replace(/["“”][^"“”]*["“”]/g, ' ');
    return /\b(you|your|you're|yourself)\b/i.test(withoutQuotedDialogue);
}
function extractExpectedAge(chartData) {
    const text = String(chartData || '');
    const patterns = [
        /\b- Age:\s*(\d{1,3})\b/i,
        /\bCurrent Age:\s*(\d{1,3})\b/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const age = Number(m[1]);
            if (Number.isFinite(age) && age > 0 && age < 130)
                return age;
        }
    }
    return undefined;
}
function parseSimpleNumberWords(raw) {
    const token = String(raw || '').toLowerCase().replace(/[^a-z-\s]/g, '').trim();
    if (!token)
        return undefined;
    const units = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
        ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    };
    const tens = {
        twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    };
    if (token in units)
        return units[token];
    if (token in tens)
        return tens[token];
    const normalized = token.replace(/\s+/g, '-');
    const parts = normalized.split('-').filter(Boolean);
    if (parts.length === 2 && parts[0] in tens && parts[1] in units) {
        return tens[parts[0]] + units[parts[1]];
    }
    return undefined;
}
function findAgeMismatch(text, expectedAge) {
    if (!expectedAge)
        return null;
    const body = String(text || '');
    const numericRe = /\b(?:he|she|[A-Z][a-z]+)\s+is\s+(\d{1,3})\s+years?\s+(?:old|into(?:\s+this\s+(?:incarnation|life))?)\b/gi;
    let m;
    while ((m = numericRe.exec(body)) !== null) {
        const found = Number(m[1]);
        if (Number.isFinite(found) && found !== expectedAge) {
            return `age_mismatch:${found}_expected:${expectedAge}`;
        }
    }
    const wordsRe = /\b(?:he|she|[A-Z][a-z]+)\s+is\s+([a-z]+(?:[-\s][a-z]+)?)\s+years?\s+(?:old|into(?:\s+this\s+(?:incarnation|life))?)\b/gi;
    while ((m = wordsRe.exec(body)) !== null) {
        const foundWord = m[1] || '';
        const found = parseSimpleNumberWords(foundWord);
        if (typeof found === 'number' && found !== expectedAge) {
            return `age_mismatch:${found}_expected:${expectedAge}`;
        }
    }
    return null;
}
const FORBIDDEN_PATTERNS = [
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
    {
        id: 'technical_planet_sign_structure',
        re: /\b(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/i,
    },
    {
        id: 'technical_planet_house_structure',
        re: /\b(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:his|her|the)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+(?:st|nd|rd|th))\s+house\b/i,
    },
];
function getForbiddenMatchIds(text) {
    const t = String(text || '');
    const matches = [];
    for (const p of FORBIDDEN_PATTERNS) {
        if (p.re.test(t))
            matches.push(p.id);
    }
    return matches;
}
function hasForbiddenPhrases(text) {
    return getForbiddenMatchIds(text).length > 0;
}
function hasBannedDetours(text) {
    return /\b(office|workplace)\b/i.test(String(text || '')) ||
        /\bat work\b/i.test(String(text || '')) ||
        /\bteam meeting\b/i.test(String(text || '')) ||
        /\b(social justice|environmental sustainability|world healing)\b/i.test(String(text || ''));
}
function extractZone2(text, zone1MaxWords = 700) {
    const raw = String(text || '').trim();
    if (!raw)
        return '';
    const re = /\S+/g;
    let wordCount = 0;
    let splitIdx = -1;
    let m;
    while ((m = re.exec(raw)) !== null) {
        wordCount += 1;
        if (wordCount === zone1MaxWords + 1) {
            splitIdx = m.index;
            break;
        }
    }
    if (splitIdx < 0)
        return '';
    return raw.slice(splitIdx).trim();
}
function getComplianceIssues(text) {
    const issues = [];
    if (hasSecondPerson(text))
        issues.push('second_person');
    const forbidden = getForbiddenMatchIds(text);
    if (forbidden.length > 0)
        issues.push(`forbidden_phrase:${forbidden.slice(0, 6).join(',')}`);
    if (hasBannedDetours(text))
        issues.push('banned_detour');
    return issues;
}
function getTechnicalAstroReportLines(text) {
    const lines = String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    const re = /\b((?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)|(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:his|her|the)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+(?:st|nd|rd|th))\s+house|\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b\s+(?:conjunct|opposes?|squares?|trines?|sextiles?)\s+\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b|conjunction|opposition|square|trine|sextile|profection|lord of year|house\s+\d+|natal|transit)\b/i;
    return lines.filter((line) => re.test(line)).slice(0, 20);
}
function extractChartSignatureFooter(text) {
    const raw = String(text || '').trim();
    if (!raw)
        return { body: '', footer: '' };
    const lines = raw.split('\n');
    const footerLineRe = /^\s*(Chart Signature:|Data:|Publisher:|1-in-a-billion\.app\b)/i;
    const chartSigLineRe = /^\s*Chart Signature:/i;
    const chartSigIndices = lines
        .map((line, idx) => (chartSigLineRe.test(line) ? idx : -1))
        .filter((idx) => idx >= 0);
    if (chartSigIndices.length === 0) {
        return {
            body: raw.replace(/\n{3,}/g, '\n\n').trim(),
            footer: '',
        };
    }
    const lastChartSigIdx = chartSigIndices[chartSigIndices.length - 1];
    const tail = lines.slice(lastChartSigIdx);
    const chartSig = tail.find((line) => chartSigLineRe.test(line))?.trim();
    const data = tail.find((line) => /^\s*Data:/i.test(line))?.trim();
    const publisher = tail.find((line) => /^\s*Publisher:/i.test(line))?.trim();
    const site = tail.find((line) => /^\s*1-in-a-billion\.app\b/i.test(line))?.trim();
    const footer = [chartSig, data, publisher, site]
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    const body = lines
        .filter((line) => !footerLineRe.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { body, footer };
}
// LLM calls now use centralized service (src/services/llm.ts)
// Provider controlled by LLM_PROVIDER env var (deepseek | claude | openai)
class TextWorker extends baseWorker_1.BaseWorker {
    constructor() {
        super({
            taskTypes: ['text_generation'],
            maxConcurrentTasks: 2,
        });
    }
    async processTask(task) {
        if (!supabaseClient_1.supabase)
            return { success: false, error: 'Supabase not configured' };
        // ===========================================================================
        // SWISS EPHEMERIS DIAGNOSTIC - Check health BEFORE attempting calculations
        // Using ISOLATED process to prevent crashes from killing main worker
        // ===========================================================================
        console.log('=== SWISS EPHEMERIS DIAGNOSTIC START ===');
        try {
            const healthCheck = await ephemerisIsolation_1.ephemerisIsolation.healthCheck();
            console.log('Swiss Ephemeris Health Check Result:', JSON.stringify(healthCheck, null, 2));
            if (healthCheck.status !== 'ok') {
                const errorMsg = `Swiss Ephemeris NOT ready: ${healthCheck.message}`;
                console.error('❌', errorMsg);
                return { success: false, error: errorMsg };
            }
            console.log('✅ Swiss Ephemeris is healthy, proceeding with task');
        }
        catch (healthError) {
            const errorMsg = `Swiss Ephemeris health check FAILED: ${healthError.message}`;
            console.error('❌', errorMsg);
            return { success: false, error: errorMsg };
        }
        console.log('=== SWISS EPHEMERIS DIAGNOSTIC END ===');
        const jobId = task.job_id;
        // Load job params
        const { data: job, error: jobErr } = await supabaseClient_1.supabase
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
        const params = job.params || {};
        const person1 = params.person1;
        const person2 = params.person2; // Optional for single-person readings
        if (!person1) {
            return { success: false, error: 'Missing person1 in job.params' };
        }
        const style = params.style || 'spicy_surreal';
        const spiceLevel = clampSpice(params.relationshipPreferenceScale ?? params.relationshipIntensity ?? 5);
        // Task input schema (we keep it flexible)
        const docNum = Number(task.input?.docNum ?? task.sequence + 1);
        const docType = task.input?.docType ||
            (job.type === 'extended' ? 'individual' : (docNum === 16 ? 'verdict' : 'person1'));
        const system = task.input?.system ?? null;
        const title = task.input?.title || (docType === 'verdict' ? 'Final Verdict' : 'Untitled');
        const requestedSystems = Array.isArray(params.systems) ? params.systems : [];
        const systemsCount = requestedSystems.length > 0 ? requestedSystems.length : 1;
        const docsTotal = job.type === 'bundle_verdict' || job.type === 'nuclear_v2'
            ? 16
            : job.type === 'synastry'
                ? systemsCount * 3
                : systemsCount; // extended: 1 doc per system
        // Update progress: text generation started
        await supabaseClient_1.supabase.rpc('update_job_progress', {
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
        let p1Placements;
        let p2Placements;
        try {
            p1Placements = await ephemerisIsolation_1.ephemerisIsolation.computePlacements({
                birthDate: person1.birthDate,
                birthTime: person1.birthTime,
                timezone: person1.timezone,
                latitude: person1.latitude,
                longitude: person1.longitude,
                relationshipIntensity: spiceLevel,
                relationshipMode: 'sensual',
                primaryLanguage: 'en',
            });
        }
        catch (p1Error) {
            const errorMsg = `Person 1 ephemeris calculation failed: ${p1Error.message}`;
            console.error('❌', errorMsg);
            return { success: false, error: errorMsg };
        }
        // Only compute person2 placements if person2 exists (for overlay readings)
        if (person2) {
            try {
                p2Placements = await ephemerisIsolation_1.ephemerisIsolation.computePlacements({
                    birthDate: person2.birthDate,
                    birthTime: person2.birthTime,
                    timezone: person2.timezone,
                    latitude: person2.latitude,
                    longitude: person2.longitude,
                    relationshipIntensity: spiceLevel,
                    relationshipMode: 'sensual',
                    primaryLanguage: 'en',
                });
            }
            catch (p2Error) {
                const errorMsg = `Person 2 ephemeris calculation failed: ${p2Error.message}`;
                console.error('❌', errorMsg);
                return { success: false, error: errorMsg };
            }
        }
        else {
            p2Placements = null; // No person2 for single-person readings
        }
        const p1BirthData = {
            birthDate: person1.birthDate,
            birthTime: person1.birthTime,
            // Use city name only. Never fall back to raw coordinates - they sound
            // terrible in both LLM prompts and audio intros.  Omit gracefully instead.
            birthPlace: person1.birthPlace || '',
            timezone: person1.timezone,
        };
        const p2BirthData = person2 ? {
            birthDate: person2.birthDate,
            birthTime: person2.birthTime,
            birthPlace: person2.birthPlace || '',
            timezone: person2.timezone,
        } : null;
        // ===========================================================================
        // CRITICAL FIX: Build chart data based on docType!
        // - person1 docs: Only include person1's chart (no person2 data)
        // - person2 docs: Only include person2's chart (no person1 data)
        // - overlay/verdict docs: Include both charts
        // This prevents the LLM from writing about relationships in individual readings
        // ===========================================================================
        let chartData;
        if (docType === 'person1' || docType === 'individual') {
            // Person1/individual reading - ONLY person1's chart
            chartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system || 'western', person1.name, p1Placements, null, // NO person2 data for individual readings!
            null, p1BirthData, null);
            console.log(`📊 [TextWorker] Building ${system} chart data for ${docType} doc ${docNum} (individual only)`);
        }
        else if (docType === 'person2') {
            // Person2 individual reading - ONLY person2's chart
            if (!person2 || !p2Placements || !p2BirthData) {
                throw new Error(`person2 doc requires person2 data, but it's missing for job ${jobId}`);
            }
            chartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system || 'western', person2.name, p2Placements, null, // NO person1 data for individual readings!
            null, p2BirthData, null);
            console.log(`📊 [TextWorker] Building ${system} chart data for person2 doc ${docNum} (individual only)`);
        }
        else {
            // Overlay/verdict/other - include both charts
            chartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system || 'western', person1.name, p1Placements, person2?.name || null, p2Placements, p1BirthData, p2BirthData);
            console.log(`📊 [TextWorker] Building ${system} chart data for ${docType} doc ${docNum} (both people)`);
        }
        // Default: prompts see the full chart data. Some systems (Western) can be too heavy,
        // so we optionally replace this with a curated digest (two-pass prompting).
        let chartDataForPrompt = chartData;
        const expectedAge = extractExpectedAge(chartData);
        // ─── Build chart reference page(s) for PDF injection ───────────────────────
        // For individual docs: single chart reference page (person1 or person2)
        // For overlay docs: two side-by-side pages (person1 left, person2 right)
        let chartRefPage = '';
        let chartRefPageRight = '';
        if (docType === 'person2' && person2) {
            chartRefPage = (0, chartReferencePage_1.buildChartReferencePage)({
                chartData,
                personName: person2.name,
                birth: { birthDate: person2.birthDate, birthTime: person2.birthTime, birthPlace: p2BirthData?.birthPlace },
                generatedAt: new Date(),
                compact: true,
                system: system || 'western',
            });
        }
        else if (docType === 'overlay' && person2) {
            // For overlay: build separate reference pages for each person
            const p1ChartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system || 'western', person1.name, p1Placements, null, null, p1BirthData, null);
            const p2ChartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system || 'western', person2.name, p2Placements, null, null, p2BirthData, null);
            chartRefPage = (0, chartReferencePage_1.buildChartReferencePage)({
                chartData: p1ChartData,
                personName: person1.name,
                birth: { birthDate: person1.birthDate, birthTime: person1.birthTime, birthPlace: p1BirthData.birthPlace },
                generatedAt: new Date(),
                compact: true,
                system: system || 'western',
            });
            chartRefPageRight = (0, chartReferencePage_1.buildChartReferencePage)({
                chartData: p2ChartData,
                personName: person2.name,
                birth: { birthDate: person2.birthDate, birthTime: person2.birthTime, birthPlace: p2BirthData.birthPlace },
                generatedAt: new Date(),
                compact: true,
                system: system || 'western',
            });
        }
        else {
            // person1 / individual
            chartRefPage = (0, chartReferencePage_1.buildChartReferencePage)({
                chartData,
                personName: person1.name,
                birth: { birthDate: person1.birthDate, birthTime: person1.birthTime, birthPlace: p1BirthData.birthPlace },
                generatedAt: new Date(),
                compact: true,
                system: system || 'western',
            });
        }
        console.log(`📋 [TextWorker] Chart reference page built: ${chartRefPage.length} chars${chartRefPageRight ? `, right: ${chartRefPageRight.length} chars` : ''}`);
        let prompt = '';
        let composedV2 = null;
        let label = `job:${jobId}:doc:${docNum}`;
        let text = '';
        let wordCount = 0;
        let generationComplete = false;
        let narrativeTriggerForOutput = '';
        if (docType === 'verdict') {
            if (job.type !== 'bundle_verdict' && job.type !== 'nuclear_v2') {
                throw new Error(`Verdict docType is only valid for bundle_verdict jobs (got ${job.type})`);
            }
            // Existing verdict logic: summarize prior docs and ask LLM to synthesize.
            const { data: tasks, error: tasksErr } = await supabaseClient_1.supabase
                .from('job_tasks')
                .select('sequence, output')
                .eq('job_id', jobId)
                .eq('task_type', 'text_generation')
                .eq('status', 'complete');
            if (tasksErr) {
                throw new Error(`Failed to fetch prior tasks for verdict: ${tasksErr.message}`);
            }
            const completedOutputs = (tasks || [])
                .map((t) => t.output)
                .filter(Boolean)
                .filter((o) => o.docNum && o.docNum !== 16)
                .sort((a, b) => (a.docNum ?? 0) - (b.docNum ?? 0));
            const person1Triggers = completedOutputs
                .filter((o) => o.docType === 'person1' || o.docType === 'individual')
                .map((o) => ({ system: String(o.system || 'unknown'), narrativeTrigger: String(o.narrativeTrigger || '').trim() }))
                .filter((x) => x.narrativeTrigger.length > 0)
                .map((x) => `[${x.system}] ${x.narrativeTrigger}`);
            const person2Triggers = completedOutputs
                .filter((o) => o.docType === 'person2')
                .map((o) => ({ system: String(o.system || 'unknown'), narrativeTrigger: String(o.narrativeTrigger || '').trim() }))
                .filter((x) => x.narrativeTrigger.length > 0)
                .map((x) => `[${x.system}] ${x.narrativeTrigger}`);
            const overlayTriggers = completedOutputs
                .filter((o) => o.docType === 'overlay')
                .map((o) => ({ system: String(o.system || 'unknown'), narrativeTrigger: String(o.narrativeTrigger || '').trim() }))
                .filter((x) => x.narrativeTrigger.length > 0)
                .map((x) => `[${x.system}] ${x.narrativeTrigger}`);
            const summaries = completedOutputs
                .map((o) => `${o.title}: ${String(o.excerpt || '').slice(0, 600)}...`)
                .join('\n\n');
            // Production source-of-truth policy:
            // verdict should synthesize accumulated narrativeTrigger outputs from prior docs,
            // not rely on excerpt-only fallback behavior.
            const totalTriggers = person1Triggers.length + person2Triggers.length + overlayTriggers.length;
            if (totalTriggers < 5) {
                throw new Error(`Verdict requires prior narrativeTrigger outputs (found ${totalTriggers}). ` +
                    'Run/complete the system readings first so verdict can synthesize real narrativeTrigger signals.');
            }
            prompt = (0, paidReadingPrompts_1.buildVerdictPrompt)({
                person1Name: person1.name,
                person2Name: person2.name,
                allReadingsSummary: summaries || '[No summaries available]',
                person1Triggers,
                person2Triggers,
                overlayTriggers,
                spiceLevel,
                style,
                outputLanguage: params.outputLanguage,
            });
            label += ':verdict';
        }
        else {
            if (!system) {
                throw new Error(`Missing system for non-verdict doc ${docNum} (docType=${docType})`);
            }
            if (docType === 'overlay' && !person2) {
                throw new Error(`Overlay doc requires person2, but person2 is missing for job ${jobId}`);
            }
            if (docType === 'person2' && !person2) {
                throw new Error(`person2 doc requires person2, but person2 is missing for job ${jobId}`);
            }
            const buildOverlayChartParts = (systemId) => {
                if (!person2 || !p2Placements || !p2BirthData) {
                    throw new Error(`Overlay ${systemId} requires person2 chart data`);
                }
                const person1Raw = (0, chartDataBuilder_1.buildChartDataForSystem)(systemId, person1.name, p1Placements, null, null, p1BirthData, null);
                const person2Raw = (0, chartDataBuilder_1.buildChartDataForSystem)(systemId, person2.name, p2Placements, null, null, p2BirthData, null);
                return { person1Raw, person2Raw };
            };
            // ── WESTERN: narrativeTrigger engine (strip → narrativeTrigger call → writing call) ──────────
            if (system === 'western' && docType !== 'overlay') {
                const subject = docType === 'person2' ? person2 : person1;
                if (!subject?.name)
                    throw new Error(`Missing subject name for western ${docType}`);
                const stripped = (0, westernTrigger_1.stripWesternChartData)(chartData);
                const triggerPrompt = (0, westernTrigger_1.buildWesternTriggerPrompt)({ personName: subject.name, strippedChartData: stripped, spiceLevel });
                console.log(`🩸 [TextWorker] Western narrativeTrigger call for ${subject.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:narrativeTrigger`, {
                    maxTokens: 300,
                    temperature: 0.7,
                    maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'western', params.outputLanguage),
                });
                const triggerUsage = llm_1.llmPaid.getLastUsage();
                if (triggerUsage) {
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsage.provider, inputTokens: triggerUsage.usage.inputTokens, outputTokens: triggerUsage.usage.outputTokens }, `text_western_trigger_${docType}`);
                }
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger) {
                    throw new Error(`Trigger call returned empty for western ${docType}: ${subject.name}`);
                }
                narrativeTriggerForOutput = narrativeTrigger;
                console.log(`✅ [TextWorker] Western narrativeTrigger: ${narrativeTrigger.slice(0, 80)}...`);
                // Call 2: writing - bypass composePrompt entirely, use custom prompt
                const chartProvocations = (0, chartProvocations_1.buildChartAwareProvocations)(subject.name, 'western', chartData, spiceLevel);
                const baseWritingPrompt = (0, westernTrigger_1.buildWesternWritingPrompt)({
                    personName: subject.name,
                    narrativeTrigger,
                    strippedChartData: stripped,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                });
                const writingPrompt = `${chartProvocations}\n\n${baseWritingPrompt}`;
                console.log(`✍️ [TextWorker] Western writing call for ${subject.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
                    maxTokens: 16384,
                    temperature: 0.7,
                    maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'western', params.outputLanguage),
                });
                const writingUsage = llm_1.llmPaid.getLastUsage();
                if (writingUsage) {
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: writingUsage.provider, inputTokens: writingUsage.usage.inputTokens, outputTokens: writingUsage.usage.outputTokens }, `text_western_writing_${docType}`);
                }
                // Clean and return - expansion passes handled downstream if needed
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const westernFooter = extractChartSignatureFooter(text);
                text = westernFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Western reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── VEDIC narrativeTrigger engine ──────────────────────────────────────────────
            if (!generationComplete && system === 'vedic' && docType !== 'overlay') {
                const subject = docType === 'person2' ? person2 : person1;
                if (!subject?.name)
                    throw new Error(`Missing subject name for vedic ${docType}`);
                const stripped = (0, vedicTrigger_1.stripVedicChartData)(chartData);
                const triggerPrompt = (0, vedicTrigger_1.buildVedicTriggerPrompt)({ personName: subject.name, strippedChartData: stripped, spiceLevel });
                console.log(`🩸 [TextWorker] Vedic narrativeTrigger call for ${subject.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'vedic', params.outputLanguage),
                });
                const triggerUsageV = llm_1.llmPaid.getLastUsage();
                if (triggerUsageV)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageV.provider, inputTokens: triggerUsageV.usage.inputTokens, outputTokens: triggerUsageV.usage.outputTokens }, `text_vedic_trigger_${docType}`);
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger) {
                    throw new Error(`Trigger call returned empty for vedic ${docType}: ${subject.name}`);
                }
                narrativeTriggerForOutput = narrativeTrigger;
                console.log(`✅ [TextWorker] Vedic narrativeTrigger: ${narrativeTrigger.slice(0, 80)}...`);
                const chartProvocationsV = (0, chartProvocations_1.buildChartAwareProvocations)(subject.name, 'vedic', chartData, spiceLevel);
                const baseWritingPromptV = (0, vedicTrigger_1.buildVedicWritingPrompt)({
                    personName: subject.name,
                    narrativeTrigger,
                    strippedChartData: stripped,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                });
                const writingPrompt = `${chartProvocationsV}\n\n${baseWritingPromptV}`;
                console.log(`✍️ [TextWorker] Vedic writing call for ${subject.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'vedic', params.outputLanguage),
                });
                const wUsageV = llm_1.llmPaid.getLastUsage();
                if (wUsageV)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageV.provider, inputTokens: wUsageV.usage.inputTokens, outputTokens: wUsageV.usage.outputTokens }, `text_vedic_writing_${docType}`);
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const vedicFooter = extractChartSignatureFooter(text);
                text = vedicFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Vedic reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── HUMAN DESIGN narrativeTrigger engine ───────────────────────────────────────
            if (!generationComplete && system === 'human_design' && docType !== 'overlay') {
                const subject = docType === 'person2' ? person2 : person1;
                if (!subject?.name)
                    throw new Error(`Missing subject name for human_design ${docType}`);
                const stripped = (0, humanDesignTrigger_1.stripHDChartData)(chartData);
                const triggerPrompt = (0, humanDesignTrigger_1.buildHDTriggerPrompt)({ personName: subject.name, strippedChartData: stripped, spiceLevel });
                console.log(`🩸 [TextWorker] HD narrativeTrigger call for ${subject.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'human_design', params.outputLanguage),
                });
                const triggerUsageH = llm_1.llmPaid.getLastUsage();
                if (triggerUsageH)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageH.provider, inputTokens: triggerUsageH.usage.inputTokens, outputTokens: triggerUsageH.usage.outputTokens }, `text_hd_trigger_${docType}`);
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger) {
                    throw new Error(`Trigger call returned empty for human_design ${docType}: ${subject.name}`);
                }
                narrativeTriggerForOutput = narrativeTrigger;
                console.log(`✅ [TextWorker] HD narrativeTrigger: ${narrativeTrigger.slice(0, 80)}...`);
                const chartProvocationsH = (0, chartProvocations_1.buildChartAwareProvocations)(subject.name, 'human_design', chartData, spiceLevel);
                const baseWritingPromptH = (0, humanDesignTrigger_1.buildHDWritingPrompt)({
                    personName: subject.name,
                    narrativeTrigger,
                    strippedChartData: stripped,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                });
                const writingPrompt = `${chartProvocationsH}\n\n${baseWritingPromptH}`;
                console.log(`✍️ [TextWorker] HD writing call for ${subject.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'human_design', params.outputLanguage),
                });
                const wUsageH = llm_1.llmPaid.getLastUsage();
                if (wUsageH)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageH.provider, inputTokens: wUsageH.usage.inputTokens, outputTokens: wUsageH.usage.outputTokens }, `text_hd_writing_${docType}`);
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const hdFooter = extractChartSignatureFooter(text);
                text = hdFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] HD reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── GENE KEYS narrativeTrigger engine ──────────────────────────────────────────
            if (!generationComplete && system === 'gene_keys' && docType !== 'overlay') {
                const subject = docType === 'person2' ? person2 : person1;
                if (!subject?.name)
                    throw new Error(`Missing subject name for gene_keys ${docType}`);
                const stripped = (0, geneKeysTrigger_1.stripGeneKeysChartData)(chartData);
                const triggerPrompt = (0, geneKeysTrigger_1.buildGeneKeysTriggerPrompt)({ personName: subject.name, strippedChartData: stripped, spiceLevel });
                console.log(`🩸 [TextWorker] Gene Keys narrativeTrigger call for ${subject.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'gene_keys', params.outputLanguage),
                });
                const triggerUsageG = llm_1.llmPaid.getLastUsage();
                if (triggerUsageG)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageG.provider, inputTokens: triggerUsageG.usage.inputTokens, outputTokens: triggerUsageG.usage.outputTokens }, `text_gk_trigger_${docType}`);
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger) {
                    throw new Error(`Trigger call returned empty for gene_keys ${docType}: ${subject.name}`);
                }
                narrativeTriggerForOutput = narrativeTrigger;
                console.log(`✅ [TextWorker] Gene Keys narrativeTrigger: ${narrativeTrigger.slice(0, 80)}...`);
                const chartProvocationsG = (0, chartProvocations_1.buildChartAwareProvocations)(subject.name, 'gene_keys', chartData, spiceLevel);
                const baseWritingPromptG = (0, geneKeysTrigger_1.buildGeneKeysWritingPrompt)({
                    personName: subject.name,
                    narrativeTrigger,
                    strippedChartData: stripped,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                });
                const writingPrompt = `${chartProvocationsG}\n\n${baseWritingPromptG}`;
                console.log(`✍️ [TextWorker] Gene Keys writing call for ${subject.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'gene_keys', params.outputLanguage),
                });
                const wUsageG = llm_1.llmPaid.getLastUsage();
                if (wUsageG)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageG.provider, inputTokens: wUsageG.usage.inputTokens, outputTokens: wUsageG.usage.outputTokens }, `text_gk_writing_${docType}`);
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const gkFooter = extractChartSignatureFooter(text);
                text = gkFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Gene Keys reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── KABBALAH narrativeTrigger engine ───────────────────────────────────────────
            if (!generationComplete && system === 'kabbalah' && docType !== 'overlay') {
                const subject = docType === 'person2' ? person2 : person1;
                if (!subject?.name)
                    throw new Error(`Missing subject name for kabbalah ${docType}`);
                const stripped = (0, kabbalahTrigger_1.stripKabbalahChartData)(chartData);
                const triggerPrompt = (0, kabbalahTrigger_1.buildKabbalahTriggerPrompt)({ personName: subject.name, strippedChartData: stripped, spiceLevel });
                console.log(`🩸 [TextWorker] Kabbalah narrativeTrigger call for ${subject.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'kabbalah', params.outputLanguage),
                });
                const triggerUsageK = llm_1.llmPaid.getLastUsage();
                if (triggerUsageK)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageK.provider, inputTokens: triggerUsageK.usage.inputTokens, outputTokens: triggerUsageK.usage.outputTokens }, `text_kab_trigger_${docType}`);
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger) {
                    throw new Error(`Trigger call returned empty for kabbalah ${docType}: ${subject.name}`);
                }
                narrativeTriggerForOutput = narrativeTrigger;
                console.log(`✅ [TextWorker] Kabbalah narrativeTrigger: ${narrativeTrigger.slice(0, 80)}...`);
                const chartProvocationsK = (0, chartProvocations_1.buildChartAwareProvocations)(subject.name, 'kabbalah', chartData, spiceLevel);
                const baseWritingPromptK = (0, kabbalahTrigger_1.buildKabbalahWritingPrompt)({
                    personName: subject.name,
                    narrativeTrigger,
                    strippedChartData: stripped,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                });
                const writingPrompt = `${chartProvocationsK}\n\n${baseWritingPromptK}`;
                console.log(`✍️ [TextWorker] Kabbalah writing call for ${subject.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'individual', 'kabbalah', params.outputLanguage),
                });
                const wUsageK = llm_1.llmPaid.getLastUsage();
                if (wUsageK)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageK.provider, inputTokens: wUsageK.usage.inputTokens, outputTokens: wUsageK.usage.outputTokens }, `text_kab_writing_${docType}`);
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const kabFooter = extractChartSignatureFooter(text);
                text = kabFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Kabbalah reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── WESTERN OVERLAY narrativeTrigger engine ────────────────────────────────────
            if (!generationComplete && system === 'western' && docType === 'overlay') {
                const { person1Raw, person2Raw } = buildOverlayChartParts('western');
                const combinedChartData = (0, overlayTrigger_1.stripWesternOverlayData)(person1Raw, person2Raw);
                const triggerPrompt = (0, overlayTrigger_1.buildWesternOverlayTriggerPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    strippedChartData: combinedChartData,
                });
                console.log(`🩸 [TextWorker] Western overlay narrativeTrigger call for ${person1.name} & ${person2.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:overlay:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const triggerUsageO = llm_1.llmPaid.getLastUsage();
                if (triggerUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageO.provider, inputTokens: triggerUsageO.usage.inputTokens, outputTokens: triggerUsageO.usage.outputTokens }, 'text_western_overlay_trigger');
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger)
                    throw new Error(`Trigger call returned empty for western overlay: ${person1.name}/${person2.name}`);
                narrativeTriggerForOutput = narrativeTrigger;
                const writingPrompt = (0, overlayTrigger_1.buildWesternOverlayWritingPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    narrativeTrigger,
                    strippedChartData: combinedChartData,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
                });
                console.log(`✍️ [TextWorker] Western overlay writing call for ${person1.name} & ${person2.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:overlay:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const wUsageO = llm_1.llmPaid.getLastUsage();
                if (wUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageO.provider, inputTokens: wUsageO.usage.inputTokens, outputTokens: wUsageO.usage.outputTokens }, 'text_western_overlay_writing');
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const overlayFooter = extractChartSignatureFooter(text);
                text = overlayFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Western overlay reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── VEDIC OVERLAY narrativeTrigger engine ──────────────────────────────────────
            if (!generationComplete && system === 'vedic' && docType === 'overlay') {
                const { person1Raw, person2Raw } = buildOverlayChartParts('vedic');
                let combinedChartData = (0, overlayTrigger_1.stripVedicOverlayData)(person1Raw, person2Raw);
                // ── Inject compact Ashtakoot (Kundali Milan) scores ──────────────────────
                try {
                    const p1Sid = p1Placements?.sidereal;
                    const p2Sid = p2Placements?.sidereal;
                    if (p1Sid?.janmaNakshatra && p2Sid?.janmaNakshatra && p1Sid?.chandraRashi && p2Sid?.chandraRashi) {
                        const { computeVedicMatch } = require('../services/vedic/vedic_matchmaking.engine');
                        const vedicRuler = {
                            Aries: 'mars', Taurus: 'venus', Gemini: 'mercury', Cancer: 'moon',
                            Leo: 'sun', Virgo: 'mercury', Libra: 'venus', Scorpio: 'mars',
                            Sagittarius: 'jupiter', Capricorn: 'saturn', Aquarius: 'saturn', Pisces: 'jupiter',
                        };
                        const marsG1 = (p1Sid.grahas || []).find((g) => g.key === 'mars');
                        const marsG2 = (p2Sid.grahas || []).find((g) => g.key === 'mars');
                        const chart1 = {
                            id: 'person1', birth_data: { date: '', time: '', location: { latitude: 0, longitude: 0, timezone: 'UTC' } },
                            moon_nakshatra: p1Sid.janmaNakshatra, moon_sign: p1Sid.chandraRashi,
                            moon_rashi_lord: vedicRuler[p1Sid.chandraRashi] || '',
                            gana: '', yoni: '', nadi: '', varna: '', vashya: '',
                            pada: p1Sid.janmaPada || 1, mars_placement_house: marsG1?.bhava || 1,
                        };
                        const chart2 = {
                            id: 'person2', birth_data: { date: '', time: '', location: { latitude: 0, longitude: 0, timezone: 'UTC' } },
                            moon_nakshatra: p2Sid.janmaNakshatra, moon_sign: p2Sid.chandraRashi,
                            moon_rashi_lord: vedicRuler[p2Sid.chandraRashi] || '',
                            gana: '', yoni: '', nadi: '', varna: '', vashya: '',
                            pada: p2Sid.janmaPada || 1, mars_placement_house: marsG2?.bhava || 1,
                        };
                        const result = computeVedicMatch(chart1, chart2);
                        const a = result.ashtakoota;
                        const total = a.total_points;
                        let tier = 'Poor (<18)';
                        if (total >= 28)
                            tier = 'Excellent (28+)';
                        else if (total >= 24)
                            tier = 'Very Good (24-27)';
                        else if (total >= 18)
                            tier = 'Good (18-23)';
                        const doshas = [];
                        if (a.nadi.dosha_present)
                            doshas.push('Nadi Dosha (same nadi - health/progeny concern)');
                        if (a.bhakoot.score === 0)
                            doshas.push('Bhakoot Dosha (inauspicious moon-sign pair)');
                        const m1 = marsG1 && [1, 2, 4, 7, 8, 12].includes(marsG1.bhava);
                        const m2 = marsG2 && [1, 2, 4, 7, 8, 12].includes(marsG2.bhava);
                        if (m1 || m2)
                            doshas.push(`Manglik Dosha (${m1 && m2 ? 'both' : m1 ? 'person1' : 'person2'})`);
                        combinedChartData += '\n\nASHTAKOOT KUNDALI MILAN:\n' +
                            `Varna ${a.varna.score}/1 | Vashya ${a.vashya.score}/2 | Tara ${a.tara.score}/3 | Yoni ${a.yoni.score}/4 | ` +
                            `Graha Maitri ${a.graha_maitri.score}/5 | Gana ${a.gana.score}/6 | Bhakoot ${a.bhakoot.score}/7 | Nadi ${a.nadi.score}/8\n` +
                            `TOTAL: ${total}/36 - ${tier}` +
                            (doshas.length > 0 ? `\nDOSHA: ${doshas.join('; ')}` : '');
                        console.log(`🔢 [TextWorker] Ashtakoot scores injected for Vedic overlay: ${total}/36 (${tier})`);
                    }
                }
                catch (err) {
                    console.warn(`⚠️ [TextWorker] Ashtakoot scoring failed for overlay, continuing without: ${err?.message}`);
                }
                const triggerPrompt = (0, overlayTrigger_1.buildVedicOverlayTriggerPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    strippedChartData: combinedChartData,
                });
                console.log(`🩸 [TextWorker] Vedic overlay narrativeTrigger call for ${person1.name} & ${person2.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:overlay:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const triggerUsageO = llm_1.llmPaid.getLastUsage();
                if (triggerUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageO.provider, inputTokens: triggerUsageO.usage.inputTokens, outputTokens: triggerUsageO.usage.outputTokens }, 'text_vedic_overlay_trigger');
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger)
                    throw new Error(`Trigger call returned empty for vedic overlay: ${person1.name}/${person2.name}`);
                narrativeTriggerForOutput = narrativeTrigger;
                const writingPrompt = (0, overlayTrigger_1.buildVedicOverlayWritingPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    narrativeTrigger,
                    strippedChartData: combinedChartData,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
                });
                console.log(`✍️ [TextWorker] Vedic overlay writing call for ${person1.name} & ${person2.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:overlay:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const wUsageO = llm_1.llmPaid.getLastUsage();
                if (wUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageO.provider, inputTokens: wUsageO.usage.inputTokens, outputTokens: wUsageO.usage.outputTokens }, 'text_vedic_overlay_writing');
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const overlayFooter = extractChartSignatureFooter(text);
                text = overlayFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Vedic overlay reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── HUMAN DESIGN OVERLAY narrativeTrigger engine ───────────────────────────────
            if (!generationComplete && system === 'human_design' && docType === 'overlay') {
                const { person1Raw, person2Raw } = buildOverlayChartParts('human_design');
                const combinedChartData = (0, overlayTrigger_1.stripHDOverlayData)(person1Raw, person2Raw);
                const triggerPrompt = (0, overlayTrigger_1.buildHDOverlayTriggerPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    strippedChartData: combinedChartData,
                });
                console.log(`🩸 [TextWorker] HD overlay narrativeTrigger call for ${person1.name} & ${person2.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:overlay:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const triggerUsageO = llm_1.llmPaid.getLastUsage();
                if (triggerUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageO.provider, inputTokens: triggerUsageO.usage.inputTokens, outputTokens: triggerUsageO.usage.outputTokens }, 'text_hd_overlay_trigger');
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger)
                    throw new Error(`Trigger call returned empty for human_design overlay: ${person1.name}/${person2.name}`);
                narrativeTriggerForOutput = narrativeTrigger;
                const writingPrompt = (0, overlayTrigger_1.buildHDOverlayWritingPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    narrativeTrigger,
                    strippedChartData: combinedChartData,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
                });
                console.log(`✍️ [TextWorker] HD overlay writing call for ${person1.name} & ${person2.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:overlay:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const wUsageO = llm_1.llmPaid.getLastUsage();
                if (wUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageO.provider, inputTokens: wUsageO.usage.inputTokens, outputTokens: wUsageO.usage.outputTokens }, 'text_hd_overlay_writing');
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const overlayFooter = extractChartSignatureFooter(text);
                text = overlayFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] HD overlay reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── GENE KEYS OVERLAY narrativeTrigger engine ──────────────────────────────────
            if (!generationComplete && system === 'gene_keys' && docType === 'overlay') {
                const { person1Raw, person2Raw } = buildOverlayChartParts('gene_keys');
                const combinedChartData = (0, overlayTrigger_1.stripGeneKeysOverlayData)(person1Raw, person2Raw);
                const triggerPrompt = (0, overlayTrigger_1.buildGeneKeysOverlayTriggerPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    strippedChartData: combinedChartData,
                });
                console.log(`🩸 [TextWorker] Gene Keys overlay narrativeTrigger call for ${person1.name} & ${person2.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:overlay:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const triggerUsageO = llm_1.llmPaid.getLastUsage();
                if (triggerUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageO.provider, inputTokens: triggerUsageO.usage.inputTokens, outputTokens: triggerUsageO.usage.outputTokens }, 'text_gk_overlay_trigger');
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger)
                    throw new Error(`Trigger call returned empty for gene_keys overlay: ${person1.name}/${person2.name}`);
                narrativeTriggerForOutput = narrativeTrigger;
                const writingPrompt = (0, overlayTrigger_1.buildGeneKeysOverlayWritingPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    narrativeTrigger,
                    strippedChartData: combinedChartData,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
                });
                console.log(`✍️ [TextWorker] Gene Keys overlay writing call for ${person1.name} & ${person2.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:overlay:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const wUsageO = llm_1.llmPaid.getLastUsage();
                if (wUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageO.provider, inputTokens: wUsageO.usage.inputTokens, outputTokens: wUsageO.usage.outputTokens }, 'text_gk_overlay_writing');
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const overlayFooter = extractChartSignatureFooter(text);
                text = overlayFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Gene Keys overlay reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // ── KABBALAH OVERLAY narrativeTrigger engine ───────────────────────────────────
            if (!generationComplete && system === 'kabbalah' && docType === 'overlay') {
                const { person1Raw, person2Raw } = buildOverlayChartParts('kabbalah');
                const combinedChartData = (0, overlayTrigger_1.stripKabbalahOverlayData)(person1Raw, person2Raw);
                const triggerPrompt = (0, overlayTrigger_1.buildKabbalahOverlayTriggerPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    strippedChartData: combinedChartData,
                });
                console.log(`🩸 [TextWorker] Kabbalah overlay narrativeTrigger call for ${person1.name} & ${person2.name}...`);
                const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `${label}:overlay:narrativeTrigger`, {
                    maxTokens: 300, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const triggerUsageO = llm_1.llmPaid.getLastUsage();
                if (triggerUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: triggerUsageO.provider, inputTokens: triggerUsageO.usage.inputTokens, outputTokens: triggerUsageO.usage.outputTokens }, 'text_kab_overlay_trigger');
                const narrativeTrigger = String(triggerRaw || '').trim();
                if (!narrativeTrigger)
                    throw new Error(`Trigger call returned empty for kabbalah overlay: ${person1.name}/${person2.name}`);
                narrativeTriggerForOutput = narrativeTrigger;
                const writingPrompt = (0, overlayTrigger_1.buildKabbalahOverlayWritingPrompt)({
                    person1Name: person1.name,
                    person2Name: person2.name,
                    narrativeTrigger,
                    strippedChartData: combinedChartData,
                    targetWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
                });
                console.log(`✍️ [TextWorker] Kabbalah overlay writing call for ${person1.name} & ${person2.name}...`);
                text = await llm_1.llmPaid.generateStreaming(writingPrompt, `${label}:overlay:writing`, {
                    maxTokens: 16384, temperature: 0.7, maxRetries: 3,
                    systemPrompt: (0, styles_1.getSystemPromptForStyle)(style, 'overlay', undefined, params.outputLanguage),
                });
                const wUsageO = llm_1.llmPaid.getLastUsage();
                if (wUsageO)
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, { provider: wUsageO.provider, inputTokens: wUsageO.usage.inputTokens, outputTokens: wUsageO.usage.outputTokens }, 'text_kab_overlay_writing');
                text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: false }), { preserveSurrealHeadlines: false });
                const overlayFooter = extractChartSignatureFooter(text);
                text = overlayFooter.body;
                wordCount = countWords(text);
                console.log(`✅ [TextWorker] Kabbalah overlay reading complete: ${wordCount} words`);
                generationComplete = true;
            }
            // V2 prompt engine (MD prompt layers) is the source of truth for all systems.
            // Map docType into the prompt-engine job type.
            if (!generationComplete) {
                const promptPayload = {
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
                const composed = await (0, fromJobPayload_1.composePromptFromJobStartPayload)(promptPayload);
                composedV2 = composed;
                prompt = composed.prompt;
                label += `:v2prompt:${docType}:${system}`;
                console.log(`🧩 [PromptEngine] style=${composed.diagnostics.styleLayerId} systems=${composed.diagnostics.systemLayerIds
                    .map((s) => `${s.system}:${s.layerId}`)
                    .join(',')} chars=${composed.diagnostics.totalChars}`);
            }
        }
        // Use centralized LLM service with per-system provider config
        const configuredProvider = (0, llmProviders_1.getProviderForSystem)(system || 'western');
        let llmInstance = llm_1.llm;
        const llmSystemPrompt = composedV2?.systemPrompt || undefined;
        let extractedFooter = { body: '', footer: '' };
        // Headline inference is disabled globally for stable plain-prose output.
        const preserveSurrealHeadlines = false;
        if (!generationComplete) {
            console.log(`🔧 System "${system}" → Provider: ${configuredProvider}`);
            const llmUserMessage = composedV2?.userMessage || prompt;
            const promptLength = llmUserMessage.length;
            const promptWordCount = llmUserMessage.split(/\s+/).filter(Boolean).length;
            console.log(`📝 [TextWorker] Prompt stats: ${promptLength} chars, ~${promptWordCount} words`);
            console.log(`📝 [TextWorker] systemPrompt: ${llmSystemPrompt ? `${llmSystemPrompt.length} chars` : 'none'}`);
            console.log(`📝 [TextWorker] Prompt preview (first 500 chars): ${llmUserMessage.substring(0, 500)}`);
            if (configuredProvider === 'claude') {
                llmInstance = llm_1.llmPaid;
                text = await llm_1.llmPaid.generateStreaming(llmUserMessage, label, {
                    maxTokens: 16384,
                    temperature: 0.8,
                    maxRetries: 3,
                    systemPrompt: llmSystemPrompt,
                });
            }
            else {
                llmInstance = llm_1.llm;
                text = await llm_1.llm.generate(llmUserMessage, label, {
                    maxTokens: 12000,
                    temperature: 0.8,
                    provider: configuredProvider,
                    systemPrompt: llmSystemPrompt,
                });
            }
            // 💰 LOG COST for this LLM call
            const usageData = llmInstance.getLastUsage();
            if (usageData) {
                await (0, costTracking_1.logLLMCost)(jobId, task.id, {
                    provider: usageData.provider,
                    inputTokens: usageData.usage.inputTokens,
                    outputTokens: usageData.usage.outputTokens,
                }, `text_${system || 'verdict'}_${docType}`);
            }
            // Post-process: Clean LLM output for spoken audio
            text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines }), { preserveSurrealHeadlines });
            extractedFooter = extractChartSignatureFooter(text);
            text = extractedFooter.body;
            wordCount = countWords(text);
        } // end !generationComplete
        // Length backstop:
        // Prompts already ask for ~4500 words, but some models stop early.
        // We enforce a hard floor and auto-continue in a few passes instead of failing the job.
        // Enforcement floor: keep it long-form, but don't force unnecessary expansion passes.
        // The prompt contract already targets WORD_COUNT_LIMITS.min-max.
        // CJK languages (ja/zh/ko) have no spaces; our CJK-aware countWords() counts
        // each CJK character as 1 "word". CJK text is ~0.6x English word count for
        // equivalent content, so we reduce the floor accordingly.
        const CJK_FLOOR_RATIO = 0.6;
        const cjkLang = isCJKLanguage(params.outputLanguage);
        const baseFloor = docType === 'overlay'
            ? wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min
            : docType === 'verdict'
                ? wordCounts_1.WORD_COUNT_LIMITS_VERDICT.min
                : wordCounts_1.WORD_COUNT_LIMITS.min;
        const HARD_FLOOR_WORDS = cjkLang
            ? Math.round(baseFloor * CJK_FLOOR_RATIO)
            : baseFloor;
        const MAX_EXPANSION_PASSES = 3;
        async function expandToHardFloor(initial) {
            let out = initial;
            for (let pass = 1; pass <= MAX_EXPANSION_PASSES; pass += 1) {
                const currentWords = countWords(out);
                if (currentWords >= HARD_FLOOR_WORDS)
                    break;
                const missing = HARD_FLOOR_WORDS - currentWords;
                const minAdditional = Math.max(300, missing + 250); // Buffer avoids borderline failures.
                const tail = out.length > 9000 ? out.slice(-9000) : out;
                const chartBlock = chartDataForPrompt
                    ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartDataForPrompt}`
                    : '';
                console.warn(`🧱 [TextWorker] Output too short (${currentWords} < ${HARD_FLOOR_WORDS}). Expanding pass ${pass}/${MAX_EXPANSION_PASSES} (+${minAdditional} words)...`);
                // For CJK languages, use "characters" instead of "words" in the prompt
                const unitLabel = cjkLang ? 'characters' : 'words';
                const expansionPrompt = [
                    'You are continuing an existing long-form astrology reading that was cut short.',
                    '',
                    // For non-English: instruct the LLM to continue in the same language
                    ...(params.outputLanguage && params.outputLanguage !== 'en'
                        ? [`CRITICAL: Continue writing in ${languages_1.LANGUAGE_CONFIG[params.outputLanguage]?.name || params.outputLanguage}. Do NOT switch to English.`, '']
                        : []),
                    'RULES:',
                    '- Continue seamlessly from the text below.',
                    '- Do not repeat, summarize, or restart the reading.',
                    '- Keep the same voice, intensity, and style.',
                    '- No section titles or standalone headline lines.',
                    '- No bullet points. No lists. No markdown. Continuous prose only.',
                    '- Never address the reader. No second-person pronouns (you/your/yourself).',
                    '- Do NOT introduce any new chart factors (new planet/sign/house/aspect/transit/profection) beyond what is already present in the text or explicitly listed in CHART DATA.',
                    '- If you mention any placement or transit, it must match CHART DATA exactly.',
                    preserveSurrealHeadlines
                        ? [
                            '- ZONE 2 HARD BAN: Zero technical astrology syntax in this continuation.',
                            '- Forbidden: planet-in-sign formulas (e.g. "Mars in Leo", "Moon in Scorpio"), house numbers, aspect nouns (conjunction, opposition, square, trine, sextile), degree references, transit/profection jargon.',
                            '- Forbidden even when poetic: disguised report syntax that maps placements in costume.',
                            '- Allowed: embodied behavior, relational pattern, emotional weather, architecture metaphors, concrete consequence.',
                            '- Graha/planet names may appear ONLY as mythic story characters (e.g. "Saturn crouches in the basement") without technical placement syntax.',
                            '- If you need timing language, use: "this season", "this year", "the next twelve months".',
                        ].join('\n')
                        : '- Do not drift into astrology lecture mode. Avoid definitional frames like:\n  "The Sun represents...", "The Moon governs...", "The rising sign is...", "Astrologers call...", "the ninth house is..."',
                    '- Avoid template openers like: "carries the signature of..."',
                    `- Write at least ${minAdditional} NEW ${unitLabel} before stopping.`,
                    '- Do not mention word counts.',
                    chartBlock,
                    '',
                    'TEXT TO CONTINUE FROM (do not repeat):',
                    tail,
                    '',
                    'CONTINUE NOW:',
                ].join('\n');
                const expansionLabel = `${label}:expand:${pass}`;
                let chunk;
                if (configuredProvider === 'claude') {
                    chunk = await llm_1.llmPaid.generateStreaming(expansionPrompt, expansionLabel, {
                        maxTokens: 8192,
                        temperature: 0.8,
                        maxRetries: 3,
                        systemPrompt: llmSystemPrompt,
                    });
                }
                else {
                    chunk = await llm_1.llm.generate(expansionPrompt, expansionLabel, {
                        maxTokens: 8192,
                        temperature: 0.8,
                        provider: configuredProvider,
                        systemPrompt: llmSystemPrompt,
                    });
                }
                const expUsageData = llmInstance.getLastUsage();
                if (expUsageData) {
                    await (0, costTracking_1.logLLMCost)(jobId, task.id, {
                        provider: expUsageData.provider,
                        inputTokens: expUsageData.usage.inputTokens,
                        outputTokens: expUsageData.usage.outputTokens,
                    }, `text_expand_${system || 'verdict'}_${docType}_${pass}`);
                }
                chunk = tightenParagraphs(cleanReadingText(chunk, { preserveSurrealHeadlines }), { preserveSurrealHeadlines });
                const chunkFooter = extractChartSignatureFooter(chunk);
                chunk = chunkFooter.body;
                if (preserveSurrealHeadlines) {
                    const expansionIssues = getComplianceIssues(chunk);
                    const expansionTechnical = getTechnicalAstroReportLines(chunk);
                    if (expansionIssues.length > 0 || expansionTechnical.length > 0) {
                        console.warn(`⚠️ [TextWorker] Expansion pass ${pass} has compliance drift: issues=${expansionIssues.join('|') || 'none'} technical=${expansionTechnical.length}`);
                    }
                }
                out = `${out.trim()}\n\n${chunk.trim()}`.trim();
            }
            return out;
        }
        console.log(`📏 [TextWorker] Word count: ${wordCount} | Floor: ${HARD_FLOOR_WORDS} | CJK: ${cjkLang} | Lang: ${params.outputLanguage || 'en'} | Chars: ${text.length}`);
        if (wordCount < HARD_FLOOR_WORDS) {
            console.log(`📏 [TextWorker] Word count ${wordCount} below floor ${HARD_FLOOR_WORDS} for ${system} - running expansion loop...`);
            text = await expandToHardFloor(text);
            wordCount = countWords(text);
        }
        async function rewriteIncarnationIfNeeded(initial) {
            if (!preserveSurrealHeadlines)
                return initial;
            let out = initial;
            const MAX_REWRITE_PASSES = 2;
            for (let pass = 1; pass <= MAX_REWRITE_PASSES; pass += 1) {
                const zone2Text = extractZone2(out, 700);
                const issues = zone2Text
                    ? getComplianceIssues(zone2Text).filter((issue) => issue !== 'second_person')
                    : [];
                const technicalLines = zone2Text
                    ? getTechnicalAstroReportLines(zone2Text)
                    : [];
                const ageMismatch = findAgeMismatch(out, expectedAge);
                const hasSecondPersonLeak = hasSecondPerson(out);
                if (issues.length === 0 && technicalLines.length === 0 && !ageMismatch && !hasSecondPersonLeak)
                    return out;
                console.warn(`⚠️ [TextWorker] Incarnation compliance rewrite pass ${pass}: issues=${issues.join('|') || 'none'} technicalLines=${technicalLines.length}`);
                const rewritePrompt = [
                    'Rewrite the reading below without changing its facts, storyline, or emotional arc.',
                    '',
                    'HARD REQUIREMENTS:',
                    '- Keep the same person, same chart evidence, same overall length, and same intensity.',
                    '- Do not add section titles or standalone headline lines.',
                    '- Zone 1 (first ~600 words): mythic astrology language is allowed.',
                    '- Zone 2 (after ~600 words): convert ALL technical astrology syntax into behavior language.',
                    '- Remove terms like conjunction, opposition, square, trine, sextile, transit, natal, profection, house-number syntax.',
                    '- Never use second-person pronouns.',
                    typeof expectedAge === 'number'
                        ? `- If age is mentioned, it MUST be exactly ${expectedAge}. If uncertain, omit numeric age references.`
                        : '',
                    '- Do not add markdown, bullets, or labels.',
                    '- Ensure Chart Signature/Data appear only once at the very end.',
                    '',
                    issues.length > 0 ? `Detected compliance issues: ${issues.join(', ')}` : '',
                    technicalLines.length > 0 ? `Detected technical lines to rewrite:\n${technicalLines.map((l) => `- ${l}`).join('\n')}` : '',
                    ageMismatch ? `Detected age mismatch to fix: ${ageMismatch}` : '',
                    chartDataForPrompt ? `\nCHART DATA (authoritative; do not contradict):\n${chartDataForPrompt}` : '',
                    '\nREADING TO REWRITE:',
                    out,
                ]
                    .filter(Boolean)
                    .join('\n');
                const rewriteLabel = `${label}:incarnation-rewrite:${pass}`;
                let rewritten;
                if (configuredProvider === 'claude') {
                    rewritten = await llm_1.llmPaid.generateStreaming(rewritePrompt, rewriteLabel, {
                        maxTokens: 16384,
                        temperature: 0.6,
                        maxRetries: 3,
                        systemPrompt: llmSystemPrompt,
                    });
                }
                else {
                    rewritten = await llm_1.llm.generate(rewritePrompt, rewriteLabel, {
                        maxTokens: 12000,
                        temperature: 0.6,
                        provider: configuredProvider,
                        systemPrompt: llmSystemPrompt,
                    });
                }
                out = tightenParagraphs(cleanReadingText(rewritten, { preserveSurrealHeadlines }), { preserveSurrealHeadlines });
            }
            return out;
        }
        text = await rewriteIncarnationIfNeeded(text);
        // Re-extract footer after rewrite so it cannot remain mid-document.
        extractedFooter = extractChartSignatureFooter(text);
        text = extractedFooter.body;
        wordCount = countWords(text);
        // Rewrite passes can reduce total length; top up again before final compliance/floor checks.
        if (!generationComplete && wordCount < HARD_FLOOR_WORDS) {
            text = await expandToHardFloor(text);
            extractedFooter = extractChartSignatureFooter(text);
            text = extractedFooter.body;
            wordCount = countWords(text);
        }
        if (preserveSurrealHeadlines) {
            // Zone 2 compliance only: Zone 1 may contain mythological astrology language.
            const zone2Text = extractZone2(text, 700);
            const complianceIssues = zone2Text
                ? getComplianceIssues(zone2Text).filter((issue) => issue !== 'second_person')
                : [];
            const technicalLines = zone2Text
                ? getTechnicalAstroReportLines(zone2Text)
                : [];
            const anchorLeak = findVoiceAnchorLeak(text);
            const ageMismatch = findAgeMismatch(text, expectedAge);
            const hasSecondPersonLeak = hasSecondPerson(text);
            if (anchorLeak) {
                console.warn(`⚠️ [TextWorker] Voice anchor phrase detected: ${anchorLeak}`);
            }
            if (complianceIssues.length > 0 || technicalLines.length > 0 || ageMismatch || hasSecondPersonLeak) {
                const details = [
                    complianceIssues.length > 0 ? `issues=${complianceIssues.join('|')}` : '',
                    technicalLines.length > 0 ? `technical_lines=${technicalLines.length}` : '',
                    hasSecondPersonLeak ? 'second_person_leak' : '',
                    ageMismatch ? `${ageMismatch}` : '',
                ].filter(Boolean).join(' ; ');
                throw new Error(`Incarnation compliance gate failed: ${details}`);
            }
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
        if (extractedFooter.footer) {
            text = `${text}\n\n${extractedFooter.footer}`.trim();
            wordCount = countWords(text);
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
        const dramaticTitles = await (0, titleGenerator_1.generateDramaticTitles)({
            system: system || 'western',
            personName,
            textExcerpt: excerpt,
            docType: docType,
            spiceLevel,
        });
        console.log(`✅ Dramatic titles generated:`);
        console.log(`   📖 Reading: "${dramaticTitles.readingTitle}"`);
        console.log(`   🎵 Song: "${dramaticTitles.songTitle}"`);
        // Generate Compatibility Scores for Overlay/Verdict PDFs
        let compatibilityScores;
        if (docType === 'overlay' || docType === 'verdict') {
            try {
                console.log(`🎯 Generating compatibility scores for ${docType}...`);
                compatibilityScores = await (0, compatibilityScoring_1.generateCompatibilityScores)({
                    person1Name: person1.name,
                    person2Name: person2?.name || 'Partner',
                    readingText: text,
                    chartData: chartDataForPrompt,
                    label: label,
                    isVerdict: docType === 'verdict',
                });
            }
            catch (err) {
                console.warn(`⚠️ Failed to generate compatibility scores: ${err.message}`);
            }
        }
        // Match BaseWorker storage path logic for output (so SQL trigger can enqueue audio tasks)
        const artifactType = 'text';
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
                narrativeTrigger: narrativeTriggerForOutput,
                textArtifactPath,
                headline, // Add headline to output
                chartReferencePage: chartRefPage || undefined,
                chartReferencePageRight: chartRefPageRight || undefined,
                compatibilityScores,
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
exports.TextWorker = TextWorker;
if (require.main === module) {
    const worker = new TextWorker();
    process.on('SIGTERM', () => worker.stop());
    process.on('SIGINT', () => worker.stop());
    worker.start().catch((error) => {
        console.error('Fatal worker error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=textWorker.js.map