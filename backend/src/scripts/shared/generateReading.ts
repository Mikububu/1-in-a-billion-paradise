import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { llmPaid } from '../../services/llm';
import type { SystemId } from '../../promptEngine/types';
import {
  stripWesternChartData,
  buildWesternTriggerPrompt,
  buildWesternWritingPrompt,
} from '../../promptEngine/triggerEngine/westernTrigger';
import {
  stripVedicChartData,
  buildVedicTriggerPrompt,
  buildVedicWritingPrompt,
} from '../../promptEngine/triggerEngine/vedicTrigger';
import {
  stripHDChartData,
  buildHDTriggerPrompt,
  buildHDWritingPrompt,
} from '../../promptEngine/triggerEngine/humanDesignTrigger';
import {
  stripGeneKeysChartData,
  buildGeneKeysTriggerPrompt,
  buildGeneKeysWritingPrompt,
} from '../../promptEngine/triggerEngine/geneKeysTrigger';
import {
  stripKabbalahChartData,
  buildKabbalahTriggerPrompt,
  buildKabbalahWritingPrompt,
} from '../../promptEngine/triggerEngine/kabbalahTrigger';
import {
  stripWesternOverlayData,
  stripVedicOverlayData,
  stripHDOverlayData,
  stripGeneKeysOverlayData,
  stripKabbalahOverlayData,
  buildWesternOverlayTriggerPrompt,
  buildVedicOverlayTriggerPrompt,
  buildHDOverlayTriggerPrompt,
  buildGeneKeysOverlayTriggerPrompt,
  buildKabbalahOverlayTriggerPrompt,
  buildWesternOverlayWritingPrompt,
  buildVedicOverlayWritingPrompt,
  buildHDOverlayWritingPrompt,
  buildGeneKeysOverlayWritingPrompt,
  buildKabbalahOverlayWritingPrompt,
} from '../../promptEngine/triggerEngine/overlayTrigger';
import {
  stripVerdictChartData,
  buildVerdictTriggerPrompt,
  buildVerdictWritingPrompt,
} from '../../promptEngine/triggerEngine/verdictTrigger';
import {
  NARRATIVE_TRIGGER_TITLE,
  RELATIONAL_TRIGGER_TITLE,
} from '../../promptEngine/triggerEngine/triggerConfig';

const CLAUDE_MAX_TOKENS_PER_CALL = 16384;
const WRITING_TEMPERATURE = 0.65;
const SCRIPT_VERDICT_POLICY = 'script_reconstruct';

let repoSafetyChecked = false;

function assertSafeRepoStateForV2(): void {
  if (repoSafetyChecked) return;
  repoSafetyChecked = true;

  // Escape hatch for local emergency runs.
  if (process.env.ALLOW_UNSAFE_ROOT === '1') return;

  const v2Root = path.resolve(__dirname, '../../../..');
  let status = '';
  try {
    status = execSync(`git -C "${v2Root}" status --porcelain`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Not a git checkout (or git unavailable) -> skip this safety check.
    return;
  }

  const lines = status
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  // If git paths are reported as ../..., this script is operating inside a repo state
  // that includes changes outside the V2 folder. Fail hard to avoid accidental commits.
  const outsideV2 = lines.filter((line) => /\s\.\.\//.test(line));
  if (outsideV2.length > 0) {
    const preview = outsideV2.slice(0, 8).join('\n');
    throw new Error(
      [
        'Unsafe git working tree detected (changes outside V2 folder).',
        'Refusing to run generation scripts to protect architecture boundaries.',
        'Set ALLOW_UNSAFE_ROOT=1 only if you intentionally accept this risk.',
        '',
        preview,
      ].join('\n')
    );
  }
}

function debugArtifactsEnabled(): boolean {
  return process.env.DEBUG_PROMPTS === 'true';
}

export function safeFileToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function countWords(text: string): number {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function isIncarnationStyle(styleLayerId: string): boolean {
  return safeFileToken(styleLayerId).includes('incarnation');
}

function isSoulMemoirStyle(styleLayerId: string): boolean {
  return safeFileToken(styleLayerId).includes('soul-memoir');
}

function isHeadlineLine(line: string): boolean {
  const text = String(line || '').trim();
  if (!text) return false;
  const normalized = text.replace(/[.!?]+$/, '').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 14) return false;
  if (/^\d/.test(normalized)) return false;
  const upperWords = words.filter((w) => /^[A-Z0-9'’\-]+$/.test(w)).length;
  if (upperWords / words.length >= 0.9) return true;
  if (/^(?:THE|The|A|An)\s+/.test(normalized) && words.length >= 4) return true;
  const titleLikeWords = words.filter((w) => /^[A-Z][A-Za-z'’\-]*$/.test(w) || /^[A-Z0-9'’\-]+$/.test(w)).length;
  return titleLikeWords / words.length >= 0.85;
}

function splitInlineAllCapsHeadlines(text: string): string {
  const src = String(text || '');
  const paras = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  const inlineHeadlineRe = /(\b(?:THE|A|AN)\s+[A-Z][A-Z0-9'"\-]*(?:\s+[A-Z][A-Z0-9'"\-]*){2,})(?=\s+[A-Z][a-z])/g;

  for (const p of paras) {
    if (isHeadlineLine(p)) {
      out.push(p);
      continue;
    }
    const rewritten = p.replace(inlineHeadlineRe, '\n\n$1\n\n').replace(/\n{3,}/g, '\n\n').trim();
    out.push(rewritten);
  }

  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitInlineRomanHeadings(text: string): string {
  const src = String(text || '');
  // Example we see in bad outputs:
  // "--- I. The Boy Who Learned to Count There is a particular ..."
  return src
    .replace(/(?:^|\s)[-–—]{2,}\s*[IVXLC]+\.\s+/g, '\n\n')
    // Also split bare dashed section breaks before title-like phrases.
    .replace(/(?:^|\s)[-–—]{2,}\s+(?=(?:THE|The|A|An)\s+[A-Za-z])/g, '\n\n')
    // Remove standalone separators that should never render in final prose.
    .replace(/^\s*[-–—]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function capSurrealHeadlines(text: string, maxHeadlines = 6): string {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const paras = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let seen = 0;
  const out: string[] = [];
  for (const p of paras) {
    if (isHeadlineLine(p)) {
      seen += 1;
      if (seen > maxHeadlines) {
        const lowered = p.toLowerCase();
        out.push(`${lowered.charAt(0).toUpperCase()}${lowered.slice(1)}.`);
        continue;
      }
    }
    out.push(p);
  }
  return out.join('\n\n').trim();
}

function ensureSectionHeadlines(text: string, minHeadlines = 4, maxHeadlines = 6): string {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  // Keep only model-authored headings. Never synthesize fallback headings.
  // This avoids artifacts like "The Pressure Line 1".
  const normalized = splitInlineRomanHeadings(splitInlineAllCapsHeadlines(raw));
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const existing = paragraphs.filter((p) => isHeadlineLine(p)).length;
  if (existing < minHeadlines) return normalized;
  return capSurrealHeadlines(normalized, maxHeadlines);
}

function stripLeadingCoverMetadata(text: string): string {
  const lines = String(text || '').split('\n');
  let i = 0;
  const isDateLine = (line: string) =>
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i.test(line.trim());
  const isBirthLine = (line: string) => /\b\d{1,2}:\d{2}\b/.test(line) && /·/.test(line);
  const isTitleLine = (line: string) => /^(Western Astrology|Vedic Astrology|Human Design|Gene Keys|Kabbalah)\b/i.test(line.trim());
  const isNameOnly = (line: string) => /^[A-Z][A-Za-z' -]{1,80}$/.test(line.trim());

  if (i < lines.length && isTitleLine(lines[i] || '')) i += 1;
  if (i < lines.length && isDateLine(lines[i] || '')) i += 1;
  if (i < lines.length && isNameOnly(lines[i] || '')) i += 1;
  if (i < lines.length && isBirthLine(lines[i] || '')) i += 1;
  if (i > 0) {
    while (i < lines.length && !(lines[i] || '').trim()) i += 1;
    return lines.slice(i).join('\n').trim();
  }
  return text;
}

function normalizePipeTables(text: string): string {
  const lines = String(text || '').split('\n');
  const out: string[] = [];
  let i = 0;

  const parseRow = (line: string): string[] => {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
  };

  const isSeparatorCell = (cell: string): boolean => /^:?-{3,}:?$/.test(cell);

  while (i < lines.length) {
    const line = lines[i] || '';
    if (!line.trim().startsWith('|')) {
      out.push(line);
      i += 1;
      continue;
    }

    const block: string[] = [];
    while (i < lines.length && (lines[i] || '').trim().startsWith('|')) {
      block.push(lines[i] || '');
      i += 1;
    }

    const converted: string[] = [];
    for (let r = 0; r < block.length; r += 1) {
      const cells = parseRow(block[r] || '');
      if (cells.length === 0) continue;
      if (cells.every(isSeparatorCell)) continue;
      if (
        r === 0 &&
        cells.length >= 2 &&
        /dimension/i.test(cells[0] || '') &&
        /score/i.test(cells[1] || '')
      ) {
        continue;
      }
      if (cells.length === 1) {
        converted.push(cells[0] || '');
        continue;
      }
      const left = cells[0] || '';
      const right = cells[1] || '';
      const rest = cells.slice(2).join(' | ');
      converted.push(rest ? `${left}: ${right} — ${rest}` : `${left}: ${right}`);
    }

    if (converted.length > 0) {
      out.push(...converted);
    }
  }

  return out.join('\n');
}

function cleanForPdf(raw: string): string {
  let out = String(raw || '')
    .replace(/^\s*\|---.*\|\s*$/gim, '')
    .replace(/—/g, ', ')
    .replace(/–/g, '-')
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-–—]{2,}\s*[IVXLC]+\.\s*/gim, '')
    .replace(/^\s*[-–—]{3,}\s*$/gm, '')
    .replace(/(?:^|\s)[-–—]{2,}\s+(?=(?:THE|The|A|An)\s+[A-Za-z])/g, '\n\n')
    .replace(/___/g, '')
    .replace(/__/g, '')
    .replace(/(?<!\w)_(?!\w)/g, '')
    .replace(/^(.+)\n\1$/gm, '$1')
    .replace(/^\s*The Reading Continues\s*$/gim, '')
    // Defensive scrub: never let internal file IDs leak into customer-facing prose.
    .replace(/\b(?:individual|overlay)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '');

  out = normalizePipeTables(out);

  // Remove standalone heading-like lines to keep continuous prose output stable.
  out = out.replace(/^(The |THE |CHAPTER |Section |Part )?[A-Z][A-Za-z\s]{5,40}\n\n/gm, '');
  out = stripLeadingCoverMetadata(out);

  return out
    .replace(/\s+,/g, ',')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tightenParagraphs(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return text;

  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const MIN_WORDS = 70;
  const MAX_PARAS = 24;
  const out: string[] = [];

  for (let i = 0; i < paras.length; i += 1) {
    const p = paras[i]!;
    const words = countWords(p);
    if (i === 0) {
      out.push(p);
      continue;
    }

    if (words < MIN_WORDS && out.length > 1) {
      out[out.length - 1] = `${out[out.length - 1]} ${p}`.replace(/\s+/g, ' ').trim();
      continue;
    }

    out.push(p);
  }

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

function stripHouseDefinitionSentences(text: string): string {
  const houseDef =
    /\bthe\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+(?:st|nd|rd|th))\s+house\s+is\b[^.!?]*[.!?]?/gi;
  return String(text || '')
    .replace(houseDef, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasSecondPerson(text: string): boolean {
  const body = String(text || '');
  // Allow quoted dialogue to contain "you" while enforcing narrator voice outside quotes.
  const withoutQuotedDialogue = body.replace(/["“”][^"“”]*["“”]/g, ' ');
  return /\b(you|your|you're|yourself)\b/i.test(withoutQuotedDialogue);
}

function normalizePronounGrammar(text: string): string {
  let out = String(text || '');
  const prep = '(?:for|to|with|from|about|of|like|between|around|without|within|toward|towards|behind|beyond|near|past|inside|outside|under|over|at|on|in)';
  out = out.replace(new RegExp(`\\b(${prep})\\s+he\\b`, 'gi'), '$1 him');
  out = out.replace(new RegExp(`\\b(${prep})\\s+she\\b`, 'gi'), '$1 her');
  out = out.replace(/\bwhat have he\b/gi, 'what has he');
  out = out.replace(/\bwhat have she\b/gi, 'what has she');
  out = out.replace(/\bwhere he stand\b/gi, 'where he stands');
  out = out.replace(/\bwhere she stand\b/gi, 'where she stands');
  out = out.replace(/\bwhat he do\b/gi, 'what he does');
  out = out.replace(/\bwhat she do\b/gi, 'what she does');
  out = out.replace(/\b(need|needs|needed|want|wants|wanted)\s+he\s+to\b/gi, '$1 him to');
  out = out.replace(/\b(need|needs|needed|want|wants|wanted)\s+she\s+to\b/gi, '$1 her to');
  return out;
}

function findPronounGrammarIssue(text: string): string | null {
  const body = String(text || '');
  const preposition = '(?:for|to|with|from|about|of|like|between|around|without|within|toward|towards|behind|beyond|near|past|inside|outside|under|over|at|on|in)';
  if (new RegExp(`\\b${preposition}\\s+he\\b`, 'i').test(body)) return 'he_after_preposition';
  if (new RegExp(`\\b${preposition}\\s+she\\b`, 'i').test(body)) return 'she_after_preposition';
  if (/\bwhat have he\b/i.test(body)) return 'what_have_he';
  if (/\bwhat have she\b/i.test(body)) return 'what_have_she';
  if (/\bwhere he stand\b/i.test(body)) return 'where_he_stand';
  if (/\bwhere she stand\b/i.test(body)) return 'where_she_stand';
  if (/\bwhat he do\b/i.test(body)) return 'what_he_do';
  if (/\bwhat she do\b/i.test(body)) return 'what_she_do';
  return null;
}

function parseSimpleNumberWords(raw: string): number | undefined {
  const token = String(raw || '').toLowerCase().replace(/[^a-z-\s]/g, '').trim();
  if (!token) return undefined;
  const units: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const tens: Record<string, number> = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  if (token in units) return units[token];
  if (token in tens) return tens[token];
  const normalized = token.replace(/\s+/g, '-');
  const parts = normalized.split('-').filter(Boolean);
  if (parts.length === 2 && parts[0] in tens && parts[1] in units) {
    return tens[parts[0]] + units[parts[1]];
  }
  return undefined;
}

function extractExpectedAge(chartData: string): number | undefined {
  const text = String(chartData || '');
  const patterns = [/\b- Age:\s*(\d{1,3})\b/i, /\bCurrent Age:\s*(\d{1,3})\b/i];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const age = Number(m[1]);
      if (Number.isFinite(age) && age > 0 && age < 130) return age;
    }
  }
  return undefined;
}

function findAgeMismatch(text: string, expectedAge?: number): string | null {
  if (!expectedAge) return null;
  const body = String(text || '');

  const numericRe = /\b(?:he|she|[A-Z][a-z]+)\s+is\s+(\d{1,3})\s+years?\s+(?:old|into(?:\s+this\s+(?:incarnation|life))?)\b/gi;
  let m: RegExpExecArray | null;
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
  {
    id: 'technical_planet_sign_structure',
    re: /\b(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/i,
  },
  {
    id: 'technical_planet_house_structure',
    re: /\b(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:his|her|the)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+(?:st|nd|rd|th))\s+house\b/i,
  },
];

function getForbiddenMatchIds(text: string): string[] {
  const t = String(text || '');
  const matches: string[] = [];
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(t)) matches.push(p.id);
  }
  return matches;
}

type ComplianceIssue = { kind: 'second_person' } | { kind: 'forbidden_phrase'; ids: string[] } | { kind: 'banned_detour' };

function getComplianceIssues(text: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  if (hasSecondPerson(text)) issues.push({ kind: 'second_person' });
  const forbiddenIds = getForbiddenMatchIds(text);
  if (forbiddenIds.length > 0) issues.push({ kind: 'forbidden_phrase', ids: forbiddenIds });
  if (hasBannedDetours(text)) issues.push({ kind: 'banned_detour' });
  return issues;
}

function hasBannedDetours(text: string): boolean {
  return /\b(office|workplace)\b/i.test(String(text || '')) || /\bat work\b/i.test(String(text || '')) || /\bteam meeting\b/i.test(String(text || '')) || /\b(social justice|environmental sustainability|world healing)\b/i.test(String(text || ''));
}

function extractZone2Text(text: string, zone1WordBudget = 600): string {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const re = /\S+/g;
  let wordCount = 0;
  let splitIdx = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    wordCount += 1;
    if (wordCount === zone1WordBudget + 1) {
      splitIdx = match.index;
      break;
    }
  }
  if (splitIdx < 0) return '';
  return raw.slice(splitIdx).trim();
}

function getTechnicalAstroReportLines(text: string): string[] {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const re = /\b((?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)|(?:The\s+)?(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+in\s+(?:his|her|the)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+(?:st|nd|rd|th))\s+house|\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b\s+(?:conjunct|opposes?|squares?|trines?|sextiles?)\s+\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\b|conjunction|opposition|square|trine|sextile|profection|lord of year|house\s+\d+|natal|transit|north node|south node|soul'?s direction|soul chose this timing)\b/i;
  return lines.filter((line) => re.test(line)).slice(0, 20);
}

function extractChartSignatureFooter(text: string): { body: string; footer: string } {
  const raw = String(text || '').trim();
  if (!raw) return { body: '', footer: '' };
  const lines = raw.split('\n');
  const footerLineRe = /^\s*(Chart Signature:|Data:|Publisher:|1-in-a-billion\.app\b)/i;
  const chartSigLineRe = /^\s*Chart Signature:/i;

  const chartSigIndices = lines.map((line, idx) => (chartSigLineRe.test(line) ? idx : -1)).filter((idx) => idx >= 0);

  if (chartSigIndices.length === 0) {
    return { body: raw.replace(/\n{3,}/g, '\n\n').trim(), footer: '' };
  }

  const lastChartSigIdx = chartSigIndices[chartSigIndices.length - 1]!;
  const tail = lines.slice(lastChartSigIdx);
  const chartSig = tail.find((line) => chartSigLineRe.test(line))?.trim();
  const data = tail.find((line) => /^\s*Data:/i.test(line))?.trim();
  const publisher = tail.find((line) => /^\s*Publisher:/i.test(line))?.trim();
  const site = tail.find((line) => /^\s*1-in-a-billion\.app\b/i.test(line))?.trim();

  const footer = [chartSig, data, publisher, site].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const body = lines.filter((line) => !footerLineRe.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { body, footer };
}

function findVoiceAnchorLeak(text: string): string | null {
  const body = String(text || '').toLowerCase();
  const fingerprints: Array<{ id: string; re: RegExp }> = [
    { id: 'cathedral_pray_in', re: /\bcathedral\s+they\s+want\s+to\s+pray\s+in\b/i },
    { id: 'animal_behind_closed_doors', re: /\banimal\s+that\s+appears\s+behind\s+closed\s+doors\b/i },
    { id: 'puts_pronoun_mouth_there', re: /\bputs\s+(?:his|her|its)\s+mouth\s+there\b/i },
    { id: 'precision_love_hiding', re: /\bprecision\s+is\s+a\s+form\s+of\s+love\s+and\s+a\s+form\s+of\s+hiding\b/i },
  ];
  for (const fp of fingerprints) {
    if (fp.re.test(body)) return fp.id;
  }
  return null;
}

function getEvidenceAnchors(system: SystemId, styleLayerId: string): string {
  if (isIncarnationStyle(styleLayerId)) return 'Translate chart mechanics into mythology, weather, architecture, and behavior. Avoid technical placement syntax and report-like exposition.';
  if (isSoulMemoirStyle(styleLayerId)) return 'Every paragraph must be grounded in CHART DATA internally, but do NOT mention astrology terms in the body. Translate mechanics into lived behavior.';
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
          i += 1;
        }
      }
      continue;
    }

    if (/^\s*Data\s*:/i.test(line)) {
      if (!dataLine) dataLine = line.trim();
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
  if (idx < 0) return { ok: false, reason: 'Missing "Chart Signature" footer.' };

  const body = raw.slice(0, idx);
  const forbiddenInBody = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces', 'Ascendant', 'Midheaven', 'MC', 'profection', 'transit', 'sect', 'stellium', 'retrograde', 'conjunction', 'square', 'trine', 'opposition', 'sextile', 'orb', 'degree', 'degrees', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  for (const w of forbiddenInBody) {
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\\\$&')}\\b`, 'i');
    if (re.test(body)) return { ok: false, reason: `Soul Memoir body contains astrology term "${w}".` };
  }

  const housePattern = /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house(s)?\b/i;
  if (housePattern.test(body)) return { ok: false, reason: 'Soul Memoir body contains astrological house jargon.' };

  const nodePattern = /\b(north node|south node)\b/i;
  if (nodePattern.test(body)) return { ok: false, reason: 'Soul Memoir body contains nodal jargon.' };

  const footer = raw.slice(idx).trim();
  const footerLines = footer.split('\n').map((l) => l.trim()).filter(Boolean);
  if (footerLines.length > 3) return { ok: false, reason: 'Chart Signature footer too long (must be 1-2 lines, plus optional Data line).' };

  const footerLastNonEmptyLine = footerLines[footerLines.length - 1] || '';
  const rawLastNonEmptyLine = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(-1)[0] || '';
  if (footerLastNonEmptyLine !== rawLastNonEmptyLine) return { ok: false, reason: 'Chart Signature footer must be at the very end (no text after it).' };

  return { ok: true };
}

async function repairComplianceIfNeeded(options: { system: SystemId; text: string; label: string; chartData?: string; preserveSurrealHeadlines?: boolean }): Promise<string> {
  if (options.preserveSurrealHeadlines) return options.text;

  let out = options.text;
  const MAX_PASSES = 2;

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const issues = getComplianceIssues(out);
    if (issues.length === 0) return out;

    const forbiddenIds = issues.find((i) => i.kind === 'forbidden_phrase' && 'ids' in i)?.ids || [];
    const chartData = (options.chartData || '').trim();
    const chartBlock = chartData ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartData}` : '';

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
      forbiddenIds.length > 0 ? `- Remove forbidden phrase patterns (ids): ${forbiddenIds.slice(0, 10).join(', ')}` : '',
      issues.some((i) => i.kind === 'banned_detour') ? '- Remove corporate/workplace detours (office/workplace/team meeting/at work) and generic activism tangents.' : '',
      '- Remove definitional astrology lecture frames (sentences that explain what Sun/Moon/Rising/houses "represent/govern/are"). Translate those lines into lived imagery instead.',
      '- Remove template openers that talk about "signature" in a generic way. Replace with a concrete image and tension.',
      '',
      chartBlock,
      '',
      'TEXT TO FIX (rewrite; do not quote):',
      out,
      '',
      'FIXED TEXT (output ONLY the fixed essay):',
    ].filter(Boolean).join('\n');

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

async function rewriteIncarnationStyleIfNeeded(options: {
  text: string;
  label: string;
  subjectName?: string;
  chartData?: string;
  systemPrompt?: string;
  preserveSurrealHeadlines?: boolean;
  expectedAge?: number;
}): Promise<string> {
  if (!options.preserveSurrealHeadlines) return options.text;
  let out = options.text;
  const MAX_REWRITE_PASSES = 1;
  for (let pass = 1; pass <= MAX_REWRITE_PASSES; pass += 1) {
    const zone2Text = extractZone2Text(out);
    const zone2Issues = getComplianceIssues(zone2Text).filter((i) => i.kind !== 'second_person');
    const technicalLines = getTechnicalAstroReportLines(zone2Text);
    const ageMismatch = findAgeMismatch(out, options.expectedAge);
    const fullSecondPersonLeak = hasSecondPerson(out);
    if (zone2Issues.length === 0 && technicalLines.length === 0 && !ageMismatch && !fullSecondPersonLeak) return out;

    const nonSecondIssues = zone2Issues;
    const minorTechnicalDrift = technicalLines.length > 0 && technicalLines.length <= 6 && !ageMismatch;
    if (minorTechnicalDrift && nonSecondIssues.length === 0 && !fullSecondPersonLeak) {
      let cleaned = out;
      for (const line of technicalLines) {
        const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`^\\s*${escaped}\\s*$`, 'gmi'), '');
      }
      cleaned = normalizePronounGrammar(cleaned);
      cleaned = tightenParagraphs(cleanForPdf(cleaned));

      const postZone2 = extractZone2Text(cleaned);
      const postIssues = getComplianceIssues(postZone2).filter((i) => i.kind !== 'second_person');
      const postTechnical = getTechnicalAstroReportLines(postZone2);
      const postAgeMismatch = findAgeMismatch(cleaned, options.expectedAge);
      const postSecondPerson = hasSecondPerson(cleaned);
      const postPronounIssue = findPronounGrammarIssue(cleaned);
      if (postIssues.length === 0 && postTechnical.length === 0 && !postAgeMismatch && !postSecondPerson && !postPronounIssue) return cleaned;
      out = cleaned;
      continue;
    }

    const chartData = (options.chartData || '').trim();
    const chartBlock = chartData ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartData}` : '';

    const rewritePrompt = [
      'Rewrite the reading below without changing facts, storyline, or emotional arc.',
      '',
      'HARD REQUIREMENTS:',
      '- Keep one continuous essay. No section titles or standalone headline lines.',
      '- Keep third-person naming only; no second-person pronouns.',
      '- Use correct English pronoun grammar (name/he/him/she/her). Never output errors like "for he" or "what have he done".',
      '- Zone 1 (first ~600 words): mythic astrology language is allowed.',
      '- Zone 2 (after ~600 words): convert ALL technical astrology syntax into behavior language.',
      '- Remove terms like conjunction, opposition, square, trine, sextile, transit, natal, profection, house-number syntax.',
      '- Ensure Chart Signature/Data appear only once at the very end.',
      typeof options.expectedAge === 'number' ? `- If age is mentioned, it MUST be exactly ${options.expectedAge}. If uncertain, omit numeric age references.` : '',
      '- Keep length roughly unchanged. No markdown. No bullets.',
      zone2Issues.length > 0 ? `Detected Zone 2 compliance issues: ${zone2Issues.map((i) => i.kind === 'forbidden_phrase' ? `forbidden_phrase:${i.ids.slice(0, 8).join(',')}` : i.kind).join(' | ')}` : '',
      fullSecondPersonLeak ? 'Detected full-text issue: second-person pronouns must be removed globally.' : '',
      technicalLines.length > 0 ? `Detected technical lines to rewrite:\n${technicalLines.map((l) => `- ${l}`).join('\n')}` : '',
      ageMismatch ? `Detected age mismatch to fix: ${ageMismatch}` : '',
      chartBlock,
      '\nREADING TO REWRITE:',
      out,
    ].filter(Boolean).join('\n');

    const rewritten = await llmPaid.generateStreaming(rewritePrompt, `${options.label}:incarnation-rewrite:${pass}`, {
      provider: 'claude',
      maxTokens: CLAUDE_MAX_TOKENS_PER_CALL,
      temperature: 0.6,
      maxRetries: 3,
      systemPrompt: options.systemPrompt,
    });

    out = tightenParagraphs(cleanForPdf(rewritten));
  }

  return out;
}

async function expandToHardFloor(options: {
  system: SystemId;
  baseText: string;
  label: string;
  hardFloorWords: number;
  styleLayerId: string;
  chartData?: string;
  systemPrompt?: string;
  preserveSurrealHeadlines?: boolean;
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
    const chartBlock = chartData ? `\n\nCHART DATA (authoritative; do not invent or contradict):\n${chartData}` : '';

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
      options.preserveSurrealHeadlines
        ? ['- ZONE 2 HARD BAN: Zero technical astrology syntax in this continuation.', '- Forbidden: planet-in-sign formulas (e.g. "Mars in Leo", "Moon in Scorpio"), house numbers, aspect nouns (conjunction, opposition, square, trine, sextile), degree references, transit/profection jargon.', '- Forbidden even when poetic: disguised report syntax that maps placements in costume.', '- Allowed: embodied behavior, relational pattern, emotional weather, architecture metaphors, concrete consequence.', '- Graha/planet names may appear ONLY as mythic story characters (e.g. "Saturn crouches in the basement") without technical placement syntax.', '- If you need timing language, use: "this season", "this year", "the next twelve months".'].join('\n')
        : '- Do not drift into astrology lecture mode. Avoid definitional frames like:\n  "The Sun represents...", "The Moon governs...", "The rising sign is...", "Astrologers call...", "the ninth house is..."',
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
      temperature: WRITING_TEMPERATURE,
      maxRetries: 3,
      systemPrompt: options.systemPrompt,
    });

    let cleanedChunk = cleanForPdf(chunk).trim();
    const chunkFooter = extractChartSignatureFooter(cleanedChunk);
    cleanedChunk = chunkFooter.body;
    if (options.preserveSurrealHeadlines) {
      cleanedChunk = stripHouseDefinitionSentences(cleanedChunk);
      const expansionIssues = getComplianceIssues(cleanedChunk);
      const expansionTechnical = getTechnicalAstroReportLines(cleanedChunk);
      if (expansionIssues.length > 0 || expansionTechnical.length > 0) {
        let sanitized = cleanedChunk;
        for (const line of expansionTechnical) {
          const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          sanitized = sanitized.replace(new RegExp(`^\\s*${escaped}\\s*$`, 'gmi'), '');
        }
        sanitized = normalizePronounGrammar(sanitized);
        sanitized = stripHouseDefinitionSentences(sanitized);
        cleanedChunk = tightenParagraphs(cleanForPdf(sanitized));
        console.warn(`⚠️ Expansion pass ${pass} has compliance drift: issues=${expansionIssues.map((i) => i.kind === 'forbidden_phrase' ? `forbidden:${i.ids.slice(0, 4).join(',')}` : i.kind).join('|') || 'none'} technical=${expansionTechnical.length}`);
      }
    }
    out = `${out.trim()}\n\n${cleanedChunk}`.trim();
  }

  const finalWords = countWords(out);
  if (finalWords < options.hardFloorWords) {
    throw new Error(`Expansion failed: still too short after ${MAX_PASSES} passes (${finalWords} < ${options.hardFloorWords})`);
  }

  return out;
}

type TriggerPipelineBundle = {
  strippedChartData: string;
  triggerPrompt: string;
  writingPromptBase: string;
};

function countHeadlineLines(text: string): number {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  let count = 0;
  for (const p of paragraphs) {
    if (isHeadlineLine(p)) {
      count += 1;
      continue;
    }
    if (/^(?:[-–—]{2,}\s*)?[IVXLC]+\.\s+/i.test(p)) {
      count += 1;
      continue;
    }
    if (/^(?:The|A|An)\s+[A-Z][a-z'’\-]+(?:\s+[A-Z][a-z'’\-]+){2,11}$/.test(p)) {
      count += 1;
      continue;
    }
  }
  return count;
}

function stripControlTextLeaks(raw: string): string {
  const escapedTriggerTitle = NARRATIVE_TRIGGER_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedRelationalTriggerTitle = RELATIONAL_TRIGGER_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineKillRe = new RegExp(
    `\\b(?:before writing|internal arc|NARRATIVE_ARC|THE_${escapedTriggerTitle.replace(/ /g, '\\s+')}|THE_DEFENSE|ACT_1_SURFACE|ACT_2_BENEATH|ACT_3_RECKONING|LANDING_TEMPERATURE|${escapedRelationalTriggerTitle.replace(/ /g, '\\s+')}|FINAL OUTPUT REQUIREMENT|OUTPUT CONTRACT|ZONE 1|ZONE 2|NARRATOR:|METAPHOR WORLD:|STRUCTURE:|ANTI-SURVEY:|LENGTH:|CHART DATA(?:\\s*\\(.*\\))?:)\\b`,
    'i'
  );
  const fileTokenRe = /\b(?:individual|overlay|verdict)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/i;

  const lines = String(raw || '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => !lineKillRe.test(l) && !fileTokenRe.test(l));

  return lines
    .join('\n')
    .replace(new RegExp(`\\b(?:before writing|internal arc|THE_${escapedTriggerTitle.replace(/ /g, '\\s+')}|THE_DEFENSE|ACT_1_SURFACE|ACT_2_BENEATH|ACT_3_RECKONING|LANDING_TEMPERATURE|${escapedRelationalTriggerTitle.replace(/ /g, '\\s+')})\\b`, 'gi'), '')
    .replace(/\b(?:final output requirement|zone 1|zone 2|output contract)\b/gi, '')
    .replace(/\b(?:individual|overlay|verdict)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildTriggerPipelineBundle(options: {
  system: SystemId;
  docType: 'individual' | 'overlay' | 'verdict';
  personName: string;
  hardFloorWords: number;
  chartData: string;
  chartDataPerson1?: string;
  chartDataPerson2?: string;
  payloadBase: Record<string, any>;
}): TriggerPipelineBundle | null {
  const { system, docType, personName, hardFloorWords, chartData, chartDataPerson1, chartDataPerson2, payloadBase } = options;
  const p1Name = String(payloadBase?.person1?.name || 'Person 1');
  const p2Name = String(payloadBase?.person2?.name || 'Person 2');

  // Important architecture note:
  // Script generation has no prior job-task outputs, so verdict must derive
  // a fresh narrative trigger from chart data here (two-call path). Worker generation
  // instead consumes accumulated narrative trigger paragraphs from prior docs.
  if (docType === 'verdict' || payloadBase?.type === 'bundle_verdict') {
    // Explicit policy marker: script verdict generation is reconstruction-only.
    // Worker path remains source-of-truth for production verdicts from stored narrative triggers.
    const verdictMode = String(payloadBase?.verdictMode || SCRIPT_VERDICT_POLICY).trim().toLowerCase();
    if (verdictMode !== SCRIPT_VERDICT_POLICY) {
      throw new Error(
        `Unsupported verdictMode "${verdictMode}" for script path. Expected "${SCRIPT_VERDICT_POLICY}".`
      );
    }

    const stripped = stripVerdictChartData(chartData);
    return {
      strippedChartData: stripped,
      triggerPrompt: buildVerdictTriggerPrompt({
        person1Name: p1Name,
        person2Name: p2Name,
        strippedChartData: stripped,
      }),
      writingPromptBase: buildVerdictWritingPrompt({
        person1Name: p1Name,
        person2Name: p2Name,
        narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__',
        strippedChartData: stripped,
        spiceLevel: Number(payloadBase?.relationshipPreferenceScale || 7),
        targetWords: hardFloorWords,
      }),
    };
  }

  if (docType === 'individual') {
    switch (system) {
      case 'western': {
        const stripped = stripWesternChartData(chartData);
        return {
          strippedChartData: stripped,
          triggerPrompt: buildWesternTriggerPrompt({ personName, strippedChartData: stripped }),
          writingPromptBase: buildWesternWritingPrompt({ personName, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
        };
      }
      case 'vedic': {
        const stripped = stripVedicChartData(chartData);
        return {
          strippedChartData: stripped,
          triggerPrompt: buildVedicTriggerPrompt({ personName, strippedChartData: stripped }),
          writingPromptBase: buildVedicWritingPrompt({ personName, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
        };
      }
      case 'human_design': {
        const stripped = stripHDChartData(chartData);
        return {
          strippedChartData: stripped,
          triggerPrompt: buildHDTriggerPrompt({ personName, strippedChartData: stripped }),
          writingPromptBase: buildHDWritingPrompt({ personName, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
        };
      }
      case 'gene_keys': {
        const stripped = stripGeneKeysChartData(chartData);
        return {
          strippedChartData: stripped,
          triggerPrompt: buildGeneKeysTriggerPrompt({ personName, strippedChartData: stripped }),
          writingPromptBase: buildGeneKeysWritingPrompt({ personName, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
        };
      }
      case 'kabbalah': {
        const stripped = stripKabbalahChartData(chartData);
        return {
          strippedChartData: stripped,
          triggerPrompt: buildKabbalahTriggerPrompt({ personName, strippedChartData: stripped }),
          writingPromptBase: buildKabbalahWritingPrompt({ personName, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
        };
      }
      default:
        return null;
    }
  }

  const p1Raw = String(chartDataPerson1 || '').trim();
  const p2Raw = String(chartDataPerson2 || '').trim();
  if (!p1Raw || !p2Raw) return null;

  switch (system) {
    case 'western': {
      const stripped = stripWesternOverlayData(p1Raw, p2Raw);
      return {
        strippedChartData: stripped,
        triggerPrompt: buildWesternOverlayTriggerPrompt({ person1Name: p1Name, person2Name: p2Name, strippedChartData: stripped }),
        writingPromptBase: buildWesternOverlayWritingPrompt({ person1Name: p1Name, person2Name: p2Name, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
      };
    }
    case 'vedic': {
      const stripped = stripVedicOverlayData(p1Raw, p2Raw);
      return {
        strippedChartData: stripped,
        triggerPrompt: buildVedicOverlayTriggerPrompt({ person1Name: p1Name, person2Name: p2Name, strippedChartData: stripped }),
        writingPromptBase: buildVedicOverlayWritingPrompt({ person1Name: p1Name, person2Name: p2Name, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
      };
    }
    case 'human_design': {
      const stripped = stripHDOverlayData(p1Raw, p2Raw);
      return {
        strippedChartData: stripped,
        triggerPrompt: buildHDOverlayTriggerPrompt({ person1Name: p1Name, person2Name: p2Name, strippedChartData: stripped }),
        writingPromptBase: buildHDOverlayWritingPrompt({ person1Name: p1Name, person2Name: p2Name, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
      };
    }
    case 'gene_keys': {
      const stripped = stripGeneKeysOverlayData(p1Raw, p2Raw);
      return {
        strippedChartData: stripped,
        triggerPrompt: buildGeneKeysOverlayTriggerPrompt({ person1Name: p1Name, person2Name: p2Name, strippedChartData: stripped }),
        writingPromptBase: buildGeneKeysOverlayWritingPrompt({ person1Name: p1Name, person2Name: p2Name, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
      };
    }
    case 'kabbalah': {
      const stripped = stripKabbalahOverlayData(p1Raw, p2Raw);
      return {
        strippedChartData: stripped,
        triggerPrompt: buildKabbalahOverlayTriggerPrompt({ person1Name: p1Name, person2Name: p2Name, strippedChartData: stripped }),
        writingPromptBase: buildKabbalahOverlayWritingPrompt({ person1Name: p1Name, person2Name: p2Name, narrativeTrigger: '__NARRATIVE_TRIGGER_PLACEHOLDER__', strippedChartData: stripped, targetWords: hardFloorWords }),
      };
    }
    default:
      return null;
  }
}

export type GenerateSingleReadingOptions = {
  system: SystemId;
  personName: string;
  styleLayerId: string;
  outDir: string;
  fileBase: string;
  chartData: string;
  chartDataPerson1?: string;
  chartDataPerson2?: string;
  payloadBase: Record<string, any>;
  hardFloorWords: number;
  docType: 'individual' | 'overlay' | 'verdict';
};

export type GenerateSingleReadingResult = {
  reading: string;
  chartDataForPrompt: string;
  resolvedStyleLayerId: string;
  promptPath: string;
  userPromptPath: string;
  systemPromptPath: string;
  readingPath: string;
};

export async function generateSingleReading(options: GenerateSingleReadingOptions): Promise<GenerateSingleReadingResult> {
  assertSafeRepoStateForV2();

  const {
    system,
    personName,
    styleLayerId,
    outDir,
    fileBase,
    chartData,
    chartDataPerson1,
    chartDataPerson2,
    payloadBase,
    hardFloorWords,
    docType,
  } = options;

  const triggerBundle = buildTriggerPipelineBundle({
    system,
    docType,
    personName,
    hardFloorWords,
    chartData,
    chartDataPerson1,
    chartDataPerson2,
    payloadBase,
  });

  if (!triggerBundle) {
    throw new Error(`Trigger pipeline bundle could not be built for ${fileBase} (system=${system}, docType=${docType})`);
  }

  const writeDebugArtifacts = debugArtifactsEnabled();
  const triggerPromptPath = writeDebugArtifacts ? path.join(outDir, `${fileBase}.trigger.prompt.txt`) : '';
  const writingPromptPath = writeDebugArtifacts ? path.join(outDir, `${fileBase}.writing.prompt.txt`) : '';
  const systemPromptPath = writeDebugArtifacts ? path.join(outDir, `${fileBase}.system.txt`) : '';
  const readingPath = writeDebugArtifacts ? path.join(outDir, `${fileBase}.reading.txt`) : '';

  if (writeDebugArtifacts) {
    fs.writeFileSync(triggerPromptPath, triggerBundle.triggerPrompt, 'utf8');
    fs.writeFileSync(systemPromptPath, '', 'utf8');
  }

  const triggerRaw = await llmPaid.generateStreaming(triggerBundle.triggerPrompt, `${fileBase}:trigger`, {
    provider: 'claude',
    maxTokens: 1200,
    temperature: 0.45,
    maxRetries: 3,
  });
  const narrativeTrigger = stripControlTextLeaks(String(triggerRaw || '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim());
  if (!narrativeTrigger) throw new Error(`Trigger call returned empty text for ${fileBase}`);

  const writingPrompt = [
    triggerBundle.writingPromptBase.replace('__NARRATIVE_TRIGGER_PLACEHOLDER__', narrativeTrigger),
    '',
    'OUTPUT CONTRACT (HARD):',
    `- Minimum length: ${hardFloorWords} words.`,
    `- Preferred range: ${Math.max(hardFloorWords + 400, 4400)}-${Math.max(hardFloorWords + 2600, 7600)} words.`,
    '- Third-person narration only. Never address the subject or reader as "you/your".',
    '- Explain technical vocabulary on first use in plain language, then continue story-first.',
    '- Keep the prose compelling like an audiobook: no report tone, no bullet formatting.',
    '- Do not invent concrete biographical events, dialogue, named third parties, jobs, timelines, or incidents not present in chart data/user context.',
    '- Never output internal planning text, internal labels, or file identifiers.',
  ].join('\n');
  if (writeDebugArtifacts) {
    fs.writeFileSync(writingPromptPath, writingPrompt, 'utf8');
  }

  let finalReading = '';
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const raw = await llmPaid.generateStreaming(writingPrompt, `${fileBase}:writing:${attempt}`, {
      provider: 'claude',
      maxTokens: CLAUDE_MAX_TOKENS_PER_CALL,
      temperature: WRITING_TEMPERATURE,
      maxRetries: 3,
    });

    let candidate = cleanForPdf(raw);
    candidate = stripControlTextLeaks(candidate);
    candidate = normalizePronounGrammar(candidate);
    candidate = stripHouseDefinitionSentences(candidate);
    candidate = tightenParagraphs(candidate);

    const extracted = extractChartSignatureFooter(candidate);
    candidate = extracted.body;
    candidate = tightenParagraphs(candidate);

    let words = countWords(candidate);
    if (words < hardFloorWords) {
      try {
        candidate = await expandToHardFloor({
          system,
          baseText: candidate,
          label: fileBase,
          hardFloorWords,
          styleLayerId,
          chartData: triggerBundle.strippedChartData,
          preserveSurrealHeadlines: false,
        });
        candidate = tightenParagraphs(cleanForPdf(candidate));
        words = countWords(candidate);
      } catch (err: any) {
        console.warn(
          `⚠️ Trigger-pipeline expansion failed for ${fileBase} (attempt ${attempt}): ${err?.message || String(err)}`
        );
      }
    }

    const headlines = countHeadlineLines(candidate);
    const pronounIssue = findPronounGrammarIssue(candidate);
    const hasSecond = hasSecondPerson(candidate);
    const escapedTriggerTitle = NARRATIVE_TRIGGER_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedRelationalTriggerTitle = RELATIONAL_TRIGGER_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const controlLeakRe = new RegExp(
      `\\b(?:THE_${escapedTriggerTitle.replace(/ /g, '\\s+')}|before writing|internal arc|NARRATIVE_ARC|ACT_1_SURFACE|ACT_2_BENEATH|ACT_3_RECKONING|LANDING_TEMPERATURE|${escapedRelationalTriggerTitle.replace(/ /g, '\\s+')}|OUTPUT CONTRACT|FINAL OUTPUT REQUIREMENT|CHART DATA)\\b`,
      'i'
    );
    const hasControlLeak = controlLeakRe.test(candidate);

    if (
      words >= hardFloorWords &&
      !pronounIssue &&
      !hasControlLeak
    ) {
      finalReading = extracted.footer ? `${candidate}\n\n${extracted.footer}`.trim() : candidate;
      if (hasSecond) {
        console.warn(`⚠️ Trigger-pipeline accepted with second-person residue for ${fileBase}.`);
      }
      break;
    }
    console.warn(`⚠️ Trigger-pipeline attempt ${attempt} rejected for ${fileBase}: words=${words}, headlines=${headlines}, pronounIssue=${pronounIssue || 'none'}, secondPerson=${hasSecond}, controlLeak=${hasControlLeak}`);
  }

  if (!finalReading) {
    throw new Error(`Failed trigger pipeline generation for ${fileBase} after ${MAX_ATTEMPTS} attempts.`);
  }

  if (writeDebugArtifacts) {
    fs.writeFileSync(readingPath, finalReading, 'utf8');
  }
  return {
    reading: finalReading,
    chartDataForPrompt: triggerBundle.strippedChartData,
    resolvedStyleLayerId: styleLayerId || 'writing-style-guide-incarnation-v1',
    promptPath: writingPromptPath || '[disabled: set DEBUG_PROMPTS=true]',
    userPromptPath: writingPromptPath || '[disabled: set DEBUG_PROMPTS=true]',
    systemPromptPath: systemPromptPath || '[disabled: set DEBUG_PROMPTS=true]',
    readingPath: readingPath || '[disabled: set DEBUG_PROMPTS=true]',
  };
}
