import { HookReading } from '@/types/forms';

type LocalReadingInput = {
  type: HookReading['type'];
  sign?: string;
  relationshipPreferenceScale?: number;
  birthDate?: string;
};

const SIGN_WINDOWS = [
  { sign: 'Capricorn', start: [12, 22], end: [1, 19] },
  { sign: 'Aquarius', start: [1, 20], end: [2, 18] },
  { sign: 'Pisces', start: [2, 19], end: [3, 20] },
  { sign: 'Aries', start: [3, 21], end: [4, 19] },
  { sign: 'Taurus', start: [4, 20], end: [5, 20] },
  { sign: 'Gemini', start: [5, 21], end: [6, 20] },
  { sign: 'Cancer', start: [6, 21], end: [7, 22] },
  { sign: 'Leo', start: [7, 23], end: [8, 22] },
  { sign: 'Virgo', start: [8, 23], end: [9, 22] },
  { sign: 'Libra', start: [9, 23], end: [10, 22] },
  { sign: 'Scorpio', start: [10, 23], end: [11, 21] },
  { sign: 'Sagittarius', start: [11, 22], end: [12, 21] },
] as const;

const SIGN_TRAITS: Record<string, { essence: string; style: string; need: string }> = {
  Aries: { essence: 'direct fire', style: 'bold and immediate', need: 'honesty and momentum' },
  Taurus: { essence: 'steady earth', style: 'sensual and loyal', need: 'safety and consistency' },
  Gemini: { essence: 'curious air', style: 'playful and verbal', need: 'mental movement' },
  Cancer: { essence: 'protective water', style: 'nurturing and tender', need: 'emotional security' },
  Leo: { essence: 'radiant fire', style: 'warm and expressive', need: 'recognition and heart' },
  Virgo: { essence: 'precise earth', style: 'attentive and discerning', need: 'trust and usefulness' },
  Libra: { essence: 'harmonizing air', style: 'relational and elegant', need: 'balance and reciprocity' },
  Scorpio: { essence: 'intense water', style: 'all-or-nothing and deep', need: 'truth and loyalty' },
  Sagittarius: { essence: 'searching fire', style: 'adventurous and candid', need: 'freedom and meaning' },
  Capricorn: { essence: 'structured earth', style: 'committed and strategic', need: 'respect and long-term vision' },
  Aquarius: { essence: 'visionary air', style: 'independent and future-facing', need: 'space and intellectual equality' },
  Pisces: { essence: 'porous water', style: 'empathic and soulful', need: 'gentleness and depth' },
};

function parseBirthDate(dateValue?: string): { month: number; day: number } | null {
  if (!dateValue) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateValue);
  if (iso) {
    return { month: Number(iso[2]), day: Number(iso[3]) };
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateValue);
  if (slash) {
    return { month: Number(slash[1]), day: Number(slash[2]) };
  }
  return null;
}

function isBetween(month: number, day: number, start: readonly [number, number], end: readonly [number, number]) {
  const md = month * 100 + day;
  const startMd = start[0] * 100 + start[1];
  const endMd = end[0] * 100 + end[1];
  if (startMd <= endMd) return md >= startMd && md <= endMd;
  return md >= startMd || md <= endMd;
}

function estimateSignFromBirthDate(birthDate?: string): string {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return 'Unknown';
  const found = SIGN_WINDOWS.find((window) =>
    isBetween(parsed.month, parsed.day, window.start, window.end)
  );
  return found?.sign ?? 'Unknown';
}

function normalizeScale(scale?: number): number {
  if (!Number.isFinite(scale)) return 5;
  return Math.min(10, Math.max(1, Math.round(scale || 5)));
}

function describeScale(scale: number): string {
  if (scale <= 3) return 'a slow and careful pace';
  if (scale <= 7) return 'a balanced pace';
  return 'a high-intensity pace';
}

export function generateLocalHookReading(input: LocalReadingInput): HookReading {
  const type = input.type;
  const sign = input.sign && input.sign.trim().length > 0 ? input.sign : estimateSignFromBirthDate(input.birthDate);
  const traits = SIGN_TRAITS[sign] || {
    essence: 'distinctive personal energy',
    style: 'unique and individual',
    need: 'clear and honest connection',
  };
  const scale = normalizeScale(input.relationshipPreferenceScale);
  const scaleLine = describeScale(scale);

  // Sweet greetings only for Sun reading (matching backend prompt style)
  const sunGreetings = [
    'Dear child of the sun',
    'Beloved soul of light',
    'Sweet one born under golden rays',
    'Radiant heart',
  ];
  // Pick a greeting deterministically from birthDate so it's stable across reloads
  const greetingIndex = input.birthDate
    ? input.birthDate.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4
    : 0;

  const introByType: Record<HookReading['type'], string> = {
    sun: `${sunGreetings[greetingIndex]} — your Sun in ${sign} describes the central architecture of your identity, the pattern you return to when everything else is stripped away. This chart points to ${traits.essence}, expressed in a way that is ${traits.style}. In love, the Sun sign isn't what you show first; it's what you protect most fiercely. It's the version of yourself that only emerges when you feel genuinely seen.`,
    moon: `Your Moon in ${sign} maps the emotional undercurrent that runs beneath every relationship you've ever had. Under closeness, this placement expresses ${traits.style} feeling and a deep, often unspoken need for ${traits.need}. The Moon doesn't ask permission — it reacts before the mind catches up. Understanding this rhythm is the difference between partnerships that feel like home and ones that feel like performance.`,
    rising: `Your Rising in ${sign} is the doorway others walk through before they ever meet the real you. People encounter ${traits.essence} first — in your posture, your timing, the way you enter a room — long before they discover the full inner story. This is your social signature, the unconscious first impression that either invites people closer or keeps them at a comfortable distance.`,
  };

  const mainByType: Record<HookReading['type'], string> = {
    sun: `With relationship intensity set to ${scale}/10, the love dynamic asks for ${scaleLine}. In practice, this means the strongest connections form when ${traits.need} is present from the very beginning — not earned over time, but offered as a baseline. The ${sign} Sun doesn't do well with ambiguity in love. It needs to know where it stands.\n\nThis placement suggests that your deepest relationships will be the ones where you don't have to perform confidence — where ${traits.essence} is welcomed rather than managed. When that safety is present, ${sign} opens in ways that surprise even itself. The challenge is learning to recognize when that openness is being offered, and not mistaking vulnerability for weakness.`,
    moon: `At ${scale}/10 intensity, emotional safety stays central to everything. The Moon in ${sign} is healthiest when ${traits.need} is named directly, not guessed at or assumed. This placement carries an emotional intelligence that can feel like a superpower in the right relationship — and an unbearable weight in the wrong one.\n\nThe core pattern here is ${traits.style} feeling: a tendency to process love through sensation and instinct rather than logic. When the Moon in ${sign} feels safe, there's a warmth and depth that few other placements can match. When it doesn't feel safe, the withdrawal is total and swift. Learning to communicate this rhythm — rather than expecting partners to intuit it — is the single most transformative relationship skill this chart suggests.`,
    rising: `At ${scale}/10 intensity, first impressions carry more weight than usual. Your Rising in ${sign} creates a pattern where the outer presentation and the inner truth need to stay in alignment — any gap between the two will eventually create friction in close relationships.\n\nThe ${sign} Rising moves through the world with ${traits.essence}, and partners are initially drawn to exactly that quality. The deeper work is making sure the person they fell for and the person they wake up next to are recognizably the same. When ${traits.need} is present in a relationship, this alignment happens naturally. The Rising sign relaxes, the mask softens, and what's underneath — which is often more tender and complex than the exterior suggests — finally gets room to breathe.`,
  };

  return {
    type,
    sign,
    intro: introByType[type],
    main: mainByType[type],
  };
}
