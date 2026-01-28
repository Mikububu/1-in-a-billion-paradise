import { MatchCard, MatchDetail, ReadingPayload } from '../types';

const baseMatches: MatchDetail[] = [
  {
    id: 'm-001',
    name: 'Irena',
    age: 33,
    city: 'Lisbon',
    score: 9.2,
    tags: ['steady fire', 'mindful touch', 'language lover'],
    photoUrl: '',
    fitSummary: 'Shares your appetite for rare combinations: depth first, spark second.',
    fitCards: [
      'Complementary Mars and Venus placements keep chemistry alive without drama.',
      'Her Mercury overlays your Moon, so conversations stay sharp yet soft.',
      'Gene Keys emphasize steady rituals which aligns with your current dial.',
    ],
    watchouts: [
      'Both of you test partners with silence. Agree on a checkpoint signal.',
      'She needs structural plans once a week; ad-hoc changes feel unsafe.',
      'Too much fiery banter too early drains her focus.',
    ],
    firstMove: 'Send a short note about the best slow burn romance you have seen on film.',
    audio: { id: 'aud-001', status: 'locked' },
  },
  {
    id: 'm-002',
    name: 'Haruto',
    age: 35,
    city: 'Tokyo',
    score: 8.7,
    tags: ['precision humor', 'ritual builder', 'clear asks'],
    photoUrl: '',
    fitSummary: 'Keeps intensity honest with grounded pacing and sharp wit.',
    fitCards: [
      'North Node overlays his Sun, making shared goals feel intuitive.',
      'Vedic Moon syncs with your seventh house for emotional fluency.',
      'Human Design charts show complementary decision speeds.',
    ],
    watchouts: [
      'He intellectualizes conflict; invite him to name sensations, not theories.',
      'Both of you default to solo processing. Schedule micro check-ins.',
      'Jet lag hits him hard; avoid late calls after flights.',
    ],
    firstMove: 'Ask about the most accurate translation he has seen botched.',
    audio: { id: 'aud-002', status: 'processing' },
  },
  {
    id: 'm-003',
    name: 'Selene',
    age: 31,
    city: 'New York',
    score: 8.4,
    tags: ['focused loyalty', 'body intelligence', 'night owl'],
    photoUrl: '',
    fitSummary: 'Magnetic pull once you voice the emotional range you need.',
    fitCards: [
      'Scorpio Rising meets your Mars, so first meetings feel cinematic.',
      'Shared Kabbalah overlays around legacy keep plans future-facing.',
      'Both charts show advanced nervous system awareness.',
    ],
    watchouts: [
      'She senses withholding instantly; finish the uncomfortable sentence.',
      'Both of you can over analyze; set limits on state-of-the-union talks.',
      'Different sleep cycles—negotiate windows now.',
    ],
    firstMove: 'Share a photo of a still moment and ask for her version.',
    audio: { id: 'aud-003', status: 'ready', url: 'https://cdn.oneinabillion.app/audio/sample-003.mp3', durationSeconds: 142 },
  },
];

export class MatchEngine {
  getPreview(payload: ReadingPayload) {
    const offset = payload.relationshipMode === 'family' ? 0.1 : 0;
    const matches: MatchCard[] = baseMatches.map((match, index) => ({
      id: match.id,
      name: match.name,
      age: match.age,
      city: match.city,
      score: Math.min(9.5, match.score - index * 0.2 + offset),
      tags: match.tags,
      photoUrl: match.photoUrl,
      fitSummary: match.fitSummary,
    }));

    return {
      matches,
      lastUpdated: new Date().toISOString(),
    };
  }

  getDetail(matchId: string) {
    return baseMatches.find((match) => match.id === matchId) ?? baseMatches[0];
  }
}

export const matchEngine = new MatchEngine();

