import { MatchCard, MatchDetail } from '@/types/api';

export const sampleMatches: MatchCard[] = [
  {
    id: 'm-001',
    name: 'Irena',
    age: 33,
    city: 'Lisbon',
    score: 9.2,
    tags: ['steady fire', 'mindful touch', 'language lover'],
    photoUrl: '',
    fitSummary: 'Shares your appetite for rare combinations: depth first, spark second.',
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
  },
  {
    id: 'm-003',
    name: 'Selene',
    age: 31,
    city: 'New York',
    score: 8.4,
    tags: ['focused loyalty', 'body intelligence', 'night owl'],
    photoUrl: '',
    fitSummary: 'Magnetic pull when you name the emotional range you need.',
  },
];

export const sampleMatchDetails: Record<string, MatchDetail> = {
  'm-001': {
    ...sampleMatches[0],
    fitCards: [
      'Both charts show complementary Mars-Venus signatures, so desire rises naturally once trust is proven.',
      'Her Mercury overlays your Moon, unlocking candid talk about needs before they become landmines.',
      'Shared Human Design profiles say you regulate each other after demanding days.',
    ],
    watchouts: [
      'You both test new partners with silence. Agree on a signal that means “still here, still calibrating.”',
      'Her chart holds fixed fire. If you re-negotiate boundaries weekly she feels whiplash.',
      'When travel plans change she spirals. Map recovery rituals ahead of time.',
    ],
    firstMove: 'Send a voice memo about the last time you felt fully seen. Invite her to reply when she is walking.',
    audio: {
      id: 'aud-001',
      status: 'locked',
    },
  },
  'm-002': {
    ...sampleMatches[1],
    fitCards: [
      'Your North Node overlays his Sun, so both of you feel immediately purposeful together.',
      'His Vedic Moon lands in your seventh house-he reads micro-emotions without being asked.',
      'Shared Gene Keys emphasize restraint; flirting through precise questions works best.',
    ],
    watchouts: [
      'He intellectualizes conflict. Invite him to describe body cues, not theories.',
      'Both of you compartmentalize when stressed. Build a “10 minute state of us” ritual each Sunday.',
      'He protects mornings; late night texts trigger distance.',
    ],
    firstMove: 'Ask about the most delightful translation mistake he has heard. It keeps things playful and specific.',
    audio: {
      id: 'aud-002',
      status: 'processing',
    },
  },
  'm-003': {
    ...sampleMatches[2],
    fitCards: [
      'Her Scorpio Rising hits your Mars, so first meetings feel cinematic if you plan sensory details.',
      'You both prefer low-notes flirting. Share playlists that map your moods.',
      'Kabbalah overlays show aligned values around loyalty and chosen family.',
    ],
    watchouts: [
      'She can read withholding instantly. Practice finishing uncomfortable sentences.',
      'Both of you fall into investigative mode. Set limits on “what are we” conversations so chemistry stays alive.',
      'She defaults to night energy, you shift earlier. Negotiate time windows up front.',
    ],
    firstMove: 'Send a photo of a corner of your home that feels calming and ask for the story of hers.',
    audio: {
      id: 'aud-003',
      status: 'ready',
      durationSeconds: 142,
      url: 'https://cdn.oneinabillion.app/audio/sample-003.mp3',
    },
  },
};

