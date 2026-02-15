import fs from 'node:fs';
import path from 'node:path';

import { ephemerisIsolation } from '../services/ephemerisIsolation';
import { llmPaid } from '../services/llm';
import { composePromptFromJobStartPayload } from '../promptEngine/fromJobPayload';
import { buildChartDataForSystem } from '../services/chartDataBuilder';
import {
  buildWesternChartDigestPrompt,
  compactWesternChartDataForDigest,
  validateWesternDigestAgainstChartData,
} from '../promptEngine/digests/westernDigest';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';
import { getSystemDisplayName } from '../config/systemConfig';
import { WORD_COUNT_LIMITS } from '../prompts/config/wordCounts';

// Claude can be fragile on very long non-streaming requests (network resets).
// Streaming prevents timeouts, so we can run bigger calls and use fewer continuation passes.
const CLAUDE_MAX_TOKENS_PER_CALL = 8192;

function tsTag(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safeFileToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function cleanForPdf(raw: string): string {
  return String(raw || '')
    .replace(/—/g, ', ')
    .replace(/–/g, '-')
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/___/g, '')
    .replace(/__/g, '')
    .replace(/(?<!\w)_(?!\w)/g, '')
    .replace(/^(.+)\n\1$/gm, '$1')
    .replace(/^(The |THE |CHAPTER |Section |Part )?[A-Z][A-Za-z\\s]{5,40}\\n\\n/gm, '')
    .replace(/\\s+,/g, ',')
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
}

function countWords(text: string): number {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function tightenParagraphs(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return text;
  // Soul-memoir has strict footer rules; don't restructure it here.
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

    // Preserve the cold-open invocation as a standalone line.
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

type ComplianceIssue =
  | { kind: 'second_person' }
  | { kind: 'forbidden_phrase'; ids: string[] }
  | { kind: 'banned_detour' };

function getComplianceIssues(text: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  if (hasSecondPerson(text)) issues.push({ kind: 'second_person' });
  const forbiddenIds = getForbiddenMatchIds(text);
  if (forbiddenIds.length > 0) issues.push({ kind: 'forbidden_phrase', ids: forbiddenIds });
  if (hasBannedDetours(text)) issues.push({ kind: 'banned_detour' });
  return issues;
}

async function repairComplianceIfNeeded(options: {
  system: string;
  styleLayerId: string;
  text: string;
  label: string;
  chartData?: string;
}): Promise<string> {
  let out = options.text;
  const MAX_PASSES = 2;

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const issues = getComplianceIssues(out);
    if (issues.length === 0) return out;

    const forbiddenIds =
      issues.find((i) => i.kind === 'forbidden_phrase' && 'ids' in i)?.ids || [];

    const chartData = (options.chartData || '').trim();
    const chartBlock = chartData
      ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartData}`
      : '';

    const repairPrompt = [
      'You are editing an existing long-form spiritual reading. The content is good, but it violates strict style/compliance rules.',
      '',
      'YOUR JOB:',
      '- Rewrite the text to remove compliance violations WITHOUT changing the meaning, facts, or voice.',
      '- Do not add new chart factors. Do not contradict CHART DATA.',
      '- Keep it third-person only (names only). Absolutely no "you/your/yourself".',
      '- Keep it as one continuous essay (no headings, no labels, no lists, no markdown).',
      '- Do not shorten the essay; keep length roughly the same.',
      '',
      'COMPLIANCE VIOLATIONS TO FIX:',
      issues.some((i) => i.kind === 'second_person') ? '- Remove all second-person pronouns (you/your/yourself).' : '',
      forbiddenIds.length > 0
        ? `- Remove forbidden phrase patterns (ids): ${forbiddenIds.slice(0, 10).join(', ')}`
        : '',
      issues.some((i) => i.kind === 'banned_detour')
        ? '- Remove corporate/workplace detours (office/workplace/team meeting/at work) and generic activism tangents.'
        : '',
      '- Remove definitional astrology lecture frames (sentences that explain what Sun/Moon/Rising/houses "represent/govern/are"). Translate those lines into lived imagery instead.',
      '- Remove template openers that talk about "signature" in a generic way. Replace with a concrete image and tension.',
      '',
      chartBlock,
      '',
      'TEXT TO FIX (rewrite; do not quote):',
      out,
      '',
      'FIXED TEXT (output ONLY the fixed essay):',
    ]
      .filter(Boolean)
      .join('\n');

    const repaired = await llmPaid.generateStreaming(repairPrompt, `${options.label}:repair:${pass}`, {
      provider: 'claude',
      maxTokens: CLAUDE_MAX_TOKENS_PER_CALL,
      temperature: 0.35,
      maxRetries: 3,
    });

    out = tightenParagraphs(cleanForPdf(repaired));
  }

  return out;
}

function hasForbiddenPhrases(text: string): boolean {
  return /\b(in conclusion|ultimately,? at the end of the day|here's the thing|this is not just)\b/i.test(String(text || '')) ||
    /\bcarries the signature\b/i.test(String(text || '')) ||
    /\bgift and curse\b/i.test(String(text || '')) ||
    /\bfascinating tension\b/i.test(String(text || '')) ||
    /\bThe Sun represents\b/i.test(String(text || '')) ||
    /\bThe Moon governs\b/i.test(String(text || '')) ||
    /\bThe rising sign is\b/i.test(String(text || '')) ||
    /\bAstrologers call\b/i.test(String(text || '')) ||
    /\bthe (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) house is\b/i.test(String(text || '')) ||
    /\bthe (?:\\d+)(?:st|nd|rd|th) house is\b/i.test(String(text || ''));
}

function hasBannedDetours(text: string): boolean {
  return /\b(office|workplace)\b/i.test(String(text || '')) ||
    /\bat work\b/i.test(String(text || '')) ||
    /\bteam meeting\b/i.test(String(text || '')) ||
    /\b(social justice|environmental sustainability|world healing)\b/i.test(String(text || ''));
}

function isSoulMemoirStyle(styleLayerId: string): boolean {
  return safeFileToken(styleLayerId).includes('soul-memoir');
}

function getEvidenceAnchors(system: string, styleLayerId: string): string {
  if (isSoulMemoirStyle(styleLayerId)) {
    return 'Every paragraph must be grounded in CHART DATA internally, but do NOT mention astrology terms in the body. Translate mechanics into lived behavior.';
  }
  switch (system) {
    case 'western':
      return 'Every paragraph must include at least one explicit chart signal (planet, sign, house, aspect, sect/dignity, rulership, profection, transit).';
    case 'vedic':
      return 'Every paragraph must include at least one explicit Jyotish signal (Lagna, graha, bhava, rashi, nakshatra/pada, dasha, Rahu/Ketu, Navamsha).';
    case 'human_design':
      return 'Every paragraph must include at least one explicit Human Design signal (Type/Authority/Profile, a center name, a gate number, or a channel).';
    case 'gene_keys':
      return "Every paragraph must include at least one explicit Gene Keys signal (a Gene Key number, line, or a sphere name like Life's Work/Evolution/Radiance/Purpose/Attraction/IQ/EQ/SQ/Pearl/Vocation/Culture).";
    case 'kabbalah':
      return 'Every paragraph must include at least one explicit Kabbalah signal (a Sephirah name, pillar name, world name, or a Tikkun/Klipoth term).';
    default:
      return 'Every paragraph must include at least one concrete signal from CHART DATA.';
  }
}

async function expandToHardFloor(options: {
  system: string;
  baseText: string;
  label: string;
  hardFloorWords: number;
  styleLayerId: string;
  chartData?: string;
}): Promise<string> {
  const MAX_PASSES = 5;
  let out = options.baseText;

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const currentWords = countWords(out);
    if (currentWords >= options.hardFloorWords) break;

    const missing = options.hardFloorWords - currentWords;
    const minAdditional = Math.max(600, missing + 300);
    const tail = out.length > 9000 ? out.slice(-9000) : out;
    const anchors = getEvidenceAnchors(options.system, options.styleLayerId);
    const chartData = (options.chartData || '').trim();
    const chartBlock = chartData
      ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartData}`
      : '';

    const expansionPrompt = [
      'You are continuing an existing long-form spiritual reading that was cut short.',
      '',
      'RULES:',
      '- Continue seamlessly from the text below.',
      '- Do not repeat, summarize, or restart the reading.',
      '- Keep the same voice, intensity, and perspective (third-person, names only).',
      '- NEVER address the reader. No second-person pronouns anywhere (you/your/yourself).',
      '- No headings. No labels. No lists. No markdown.',
      '- Do NOT introduce any new chart factors (new planet/sign/house/aspect/transit/profection) beyond what is already present in the text or explicitly listed in CHART DATA.',
      '- If you mention any placement or transit, it must match CHART DATA exactly.',
      '- Do not drift into astrology lecture mode. Avoid definitional frames like:',
      '  "The Sun represents...", "The Moon governs...", "The rising sign is...", "Astrologers call...", "the ninth house is..."',
      '- Avoid template openers like: "carries the signature of..."',
      `- Evidence: ${anchors}`,
      '- Avoid corporate detours: office, workplace, "team meeting", "at work", etc.',
      '- No motivational filler about "the universe", "awakening", "beacon", "infinite potential", or generic community/activism tangents.',
      `- Write at least ${minAdditional} NEW words before stopping.`,
      '- Do not mention word counts.',
      chartBlock,
      '',
      'TEXT TO CONTINUE FROM (do not repeat):',
      tail,
      '',
      'CONTINUE NOW:',
    ].join('\n');

    const chunk = await llmPaid.generateStreaming(expansionPrompt, `${options.label}:expand:${pass}`, {
      provider: 'claude',
      maxTokens: CLAUDE_MAX_TOKENS_PER_CALL,
      temperature: 0.8,
      maxRetries: 3,
    });

    out = `${out.trim()}\n\n${cleanForPdf(chunk).trim()}`.trim();
  }

  const finalWords = countWords(out);
  if (finalWords < options.hardFloorWords) {
    throw new Error(
      `Expansion failed: still too short after ${MAX_PASSES} passes (${finalWords} < ${options.hardFloorWords})`
    );
  }

  return out;
}

function normalizeSoulMemoirFooter(text: string): string {
  const raw = String(text || '');
  const lines = raw.split('\n');

  let chartSignatureLine: string | undefined;
  let dataLine: string | undefined;

  const kept: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^\s*Chart Signature\s*:/i.test(line)) {
      if (!chartSignatureLine) {
        chartSignatureLine = line.trim();
        const next = lines[i + 1] ?? '';
        if (/^\s*Data\s*:/i.test(next)) {
          dataLine = next.trim();
          i += 1; // Skip the Data line too.
        }
      }
      continue;
    }

    if (/^\s*Data\s*:/i.test(line)) {
      if (!dataLine) {
        dataLine = line.trim();
      }
      continue;
    }

    kept.push(line);
  }

  const body = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const footer: string[] = [];
  if (chartSignatureLine) footer.push(chartSignatureLine);
  if (dataLine) footer.push(dataLine);

  if (footer.length === 0) return body;
  return `${body}\n\n${footer.join('\n')}`.trim();
}

function validateSoulMemoirContract(text: string): { ok: boolean; reason?: string } {
  const raw = String(text || '');
  const idx = raw.search(/\bChart Signature\b/i);
  if (idx < 0) {
    return { ok: false, reason: 'Missing "Chart Signature" footer.' };
  }

  const body = raw.slice(0, idx);
  // Keep this conservative: sign names and obvious astrology jargon should not appear in the body.
  const forbiddenInBody = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
    'Ascendant','Midheaven','MC','profection','transit','sect','stellium','retrograde',
    'conjunction','square','trine','opposition','sextile','orb','degree','degrees',
    'Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto',
  ];
  for (const w of forbiddenInBody) {
    const re = new RegExp(`\\b${w.replace(/[-/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')}\\b`, 'i');
    if (re.test(body)) {
      return { ok: false, reason: `Soul Memoir body contains astrology term "${w}".` };
    }
  }

  // Allow the everyday word "house/houses", but block obvious astrological "X house" patterns.
  const housePattern = /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house(s)?\b/i;
  if (housePattern.test(body)) {
    return { ok: false, reason: 'Soul Memoir body contains astrological house jargon.' };
  }

  // Block explicit nodal jargon but allow the everyday word "node".
  const nodePattern = /\b(north node|south node)\b/i;
  if (nodePattern.test(body)) {
    return { ok: false, reason: 'Soul Memoir body contains nodal jargon.' };
  }

  // Footer must be short (1-2 lines).
  const footer = raw.slice(idx).trim();
  const footerLines = footer.split('\n').map((l) => l.trim()).filter(Boolean);
  if (footerLines.length > 3) {
    return { ok: false, reason: 'Chart Signature footer too long (must be 1-2 lines, plus optional Data line).' };
  }

  const footerLastNonEmptyLine = footerLines[footerLines.length - 1] || '';
  const rawLastNonEmptyLine = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(-1)[0] || '';
  if (footerLastNonEmptyLine !== rawLastNonEmptyLine) {
    return { ok: false, reason: 'Chart Signature footer must be at the very end (no text after it).' };
  }

  return { ok: true };
}

async function main() {
  const outDir = path.resolve(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop/1-in-a-billion-media');
  fs.mkdirSync(outDir, { recursive: true });

  const argStyleLayer = process.argv.find((arg) => arg.startsWith('--styleLayer='));
  const styleLayerId = argStyleLayer ? argStyleLayer.replace('--styleLayer=', '').trim() : '';
  const styleToken = styleLayerId ? safeFileToken(styleLayerId) : 'default-style';

  const argPersonalContext = process.argv.find((arg) => arg.startsWith('--personalContext=') || arg.startsWith('--context='));
  const argPersonalContextFile = process.argv.find((arg) => arg.startsWith('--personalContextFile=') || arg.startsWith('--contextFile='));
  const resolvedContextRaw = argPersonalContext
    ? argPersonalContext.split('=').slice(1).join('=')
    : argPersonalContextFile
      ? fs.readFileSync(argPersonalContextFile.split('=').slice(1).join('='), 'utf8')
      : '';
  const resolvedPersonalContext = resolvedContextRaw.trim().length > 0 ? resolvedContextRaw.trim() : undefined;

  const person1 = {
    name: 'Michael',
    birthDate: '1968-08-23',
    birthTime: '13:45',
    timezone: 'Europe/Vienna',
    latitude: 46.6103,
    longitude: 13.8558,
    birthPlace: 'Villach, Austria',
    portraitPath: path.resolve(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop/Michael.jpg'),
  };

  const relationshipPreferenceScale = 7;
  const systems = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'] as const;
  const argSystems = process.argv.find((arg) => arg.startsWith('--systems='));
  const systemsToRun = argSystems
    ? (argSystems
        .replace('--systems=', '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as Array<(typeof systems)[number]>)
    : (systems as unknown as Array<(typeof systems)[number]>);

  console.log('🧮 Computing placements (Swiss Ephemeris)...');
  const placements = await ephemerisIsolation.computePlacements({
    birthDate: person1.birthDate,
    birthTime: person1.birthTime,
    timezone: person1.timezone,
    latitude: person1.latitude,
    longitude: person1.longitude,
    relationshipIntensity: relationshipPreferenceScale,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  const p1BirthData = {
    birthDate: person1.birthDate,
    birthTime: person1.birthTime,
    timezone: person1.timezone,
    birthPlace: person1.birthPlace,
  };

  const tag = tsTag();

  for (const system of systemsToRun) {
    const display = getSystemDisplayName(system);
    console.log(`\\n📝 Generating ${display} (individual)...`);

    const chartData = buildChartDataForSystem(
      system,
      person1.name,
      placements,
      null,
      null,
      p1BirthData,
      null
    );

    // Two-pass prompting (Western only): first build a compact digest, then write from the digest.
    let chartDataForPrompt = chartData;
    if (system === 'western') {
      const digestSource = compactWesternChartDataForDigest(chartData);
      const digestPrompt = buildWesternChartDigestPrompt({
        personName: person1.name,
        chartData: digestSource,
      });

      const digestPromptPath = path.join(
        outDir,
        `individual_${safeFileToken(person1.name)}_${safeFileToken(system)}_${styleToken}_${tag}.digest.prompt.txt`
      );
      fs.writeFileSync(digestPromptPath, digestPrompt, 'utf8');

      const MAX_DIGEST_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_DIGEST_ATTEMPTS; attempt += 1) {
        const digestLabel = `v2-individual-${system}-${tag}:digest:attempt:${attempt}`;
        console.log(`🧠 Western digest pass ${attempt}/${MAX_DIGEST_ATTEMPTS}...`);

        const digestRaw = await llmPaid.generateStreaming(digestPrompt, digestLabel, {
          provider: 'claude',
          maxTokens: 4096,
          temperature: 0.25 + (attempt - 1) * 0.05,
          maxRetries: 3,
        });

        const digest = String(digestRaw || '').trim();
        const validation = validateWesternDigestAgainstChartData({ digest, chartData });
        if (!validation.ok) {
          console.warn(`⚠️ Western digest validation failed: ${validation.reason || 'unknown'}`);
          continue;
        }

        chartDataForPrompt = [
          'CHART DATA (CURATED DIGEST; authoritative subset)',
          digest,
        ].join('\n\n');

        const digestOutPath = path.join(
          outDir,
          `individual_${safeFileToken(person1.name)}_${safeFileToken(system)}_${styleToken}_${tag}.digest.txt`
        );
        fs.writeFileSync(digestOutPath, digest, 'utf8');

        console.log(`✅ Western digest accepted (${validation.evidenceLines.length} evidence lines).`);
        break;
      }
    }

    const payload: any = {
      type: 'extended',
      systems: [system],
      person1: {
        name: person1.name,
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        latitude: person1.latitude,
        longitude: person1.longitude,
      },
      relationshipPreferenceScale,
      ...(resolvedPersonalContext ? { personalContext: resolvedPersonalContext } : {}),
      outputLanguage: 'en',
      outputLengthContract: {
        targetWordsMin: WORD_COUNT_LIMITS.min,
        targetWordsMax: WORD_COUNT_LIMITS.max,
        hardFloorWords: WORD_COUNT_LIMITS.min,
        note: `No filler. Add new insight density per paragraph. Single continuous essay, no headings. Third-person only (no you/your). Target ${WORD_COUNT_LIMITS.min}-${WORD_COUNT_LIMITS.max} words.`,
      },
      ...(styleLayerId
        ? {
          promptLayerDirective: {
            sharedWritingStyleLayerId: styleLayerId,
          },
        }
        : {}),
      chartData: chartDataForPrompt,
    };

    const composed = composePromptFromJobStartPayload(payload);

    const promptPath = path.join(
      outDir,
      `individual_${safeFileToken(person1.name)}_${safeFileToken(system)}_${styleToken}_${tag}.prompt.txt`
    );
    fs.writeFileSync(promptPath, composed.prompt, 'utf8');

    async function generateReadingWithRegeneration(): Promise<string> {
      const MAX_ATTEMPTS = 3;
      const baseLabel = `v2-individual-${system}-${tag}`;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const attemptLabel = `${baseLabel}:attempt:${attempt}`;
        // Claude-only generation (no fallback). Keep token budget per call small and expand in passes.
        const raw = await llmPaid.generateStreaming(composed.prompt, attemptLabel, {
          provider: 'claude',
          maxTokens: CLAUDE_MAX_TOKENS_PER_CALL,
          temperature: 0.8 + (attempt - 1) * 0.05, // nudge diversity on retries
          maxRetries: 3,
        });
        console.log(`✅ LLM used for ${display}: claude (attempt ${attempt}/${MAX_ATTEMPTS})`);

        let reading = cleanForPdf(raw);

        // Expand to hard floor (word count) in a few continuation passes.
        reading = await expandToHardFloor({
          system,
          baseText: reading,
          label: attemptLabel,
          hardFloorWords: WORD_COUNT_LIMITS.min,
          styleLayerId,
          chartData: chartDataForPrompt,
        });

        // Reduce "AI-ish" spacing: merge short paras and keep breaks more intentional.
        reading = tightenParagraphs(reading);

        if (isSoulMemoirStyle(styleLayerId)) {
          // Make the footer deterministic even if the model inserts it mid-text.
          reading = normalizeSoulMemoirFooter(reading);
          const memo = validateSoulMemoirContract(reading);
          if (!memo.ok) {
            console.warn(`⚠️ Soul Memoir contract failed for ${display} (attempt ${attempt}): ${memo.reason}`);
            continue;
          }
        }

        // If the model produces a great reading but slips into a few banned phrases,
        // repair it in-place instead of paying for a full regeneration.
        reading = await repairComplianceIfNeeded({
          system,
          styleLayerId,
          text: reading,
          label: attemptLabel,
          chartData: chartDataForPrompt,
        });

        const issues = getComplianceIssues(reading);
        if (issues.length > 0) {
          const failPath = path.join(
            outDir,
            `individual_${safeFileToken(person1.name)}_${safeFileToken(system)}_${styleToken}_${tag}.attempt-${attempt}.FAILED.reading.txt`
          );
          fs.writeFileSync(failPath, reading, 'utf8');
          const issueSummary = issues
            .map((i) => (i.kind === 'forbidden_phrase' ? `forbidden_phrase:${i.ids.slice(0, 4).join(',') || 'unknown'}` : i.kind))
            .join(' | ');
          console.warn(`⚠️ Compliance issues for ${display} (attempt ${attempt}): ${issueSummary}`);
          continue;
        }

        return reading;
      }

      throw new Error(`Failed to generate compliant text for ${display} after ${MAX_ATTEMPTS} attempts.`);
    }

    const reading = await generateReadingWithRegeneration();

    const finalWords = countWords(reading);
    if (finalWords < WORD_COUNT_LIMITS.min) {
      throw new Error(`Reading still too short for ${display}: ${finalWords} < ${WORD_COUNT_LIMITS.min}`);
    }

    const readingPath = path.join(
      outDir,
      `individual_${safeFileToken(person1.name)}_${safeFileToken(system)}_${styleToken}_${tag}.reading.txt`
    );
    fs.writeFileSync(readingPath, reading, 'utf8');

    const pdfTitle = `${display} - ${person1.name}`;
    const pdf = await generateReadingPDF({
      type: 'single',
      title: pdfTitle,
      person1: {
        name: person1.name,
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        birthPlace: person1.birthPlace,
        timezone: person1.timezone,
        portraitUrl: fs.existsSync(person1.portraitPath) ? person1.portraitPath : undefined,
      },
      chapters: [
        {
          title: pdfTitle,
          system,
          person1Reading: reading,
        },
      ],
      generatedAt: new Date(),
    });

    const pdfOut = path.join(
      outDir,
      `individual_${safeFileToken(person1.name)}_${safeFileToken(display)}_${styleToken}_${tag}.pdf`
    );
    fs.copyFileSync(pdf.filePath, pdfOut);
    console.log(`✅ Wrote PDF: ${pdfOut}`);
  }

  console.log('\\n✅ Done. Outputs in:', outDir);
}

main().catch((err) => {
  console.error('❌ v2_generate_individual_pdfs failed:', err?.message || String(err));
  process.exitCode = 1;
});
