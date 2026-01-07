export type RelationshipMode = 'family' | 'sensual';

export type ReadingPayload = {
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
  relationshipIntensity: number;
  relationshipMode: RelationshipMode;
  primaryLanguage: string;
  secondaryLanguage?: string | undefined;
  subjectName?: string | undefined;
  isPartnerReading?: boolean | undefined;
};

export type HookReading = {
  type: 'sun' | 'moon' | 'rising';
  sign: string;
  intro: string;
  main: string;
};

export type ReadingResponse = {
  reading: HookReading;
  metadata: {
    cacheHit: boolean;
    generatedAt: string;
    source: 'deepseek' | 'fallback';
  };
};

export type MatchCard = {
  id: string;
  name: string;
  age: number;
  city: string;
  score: number;
  tags: string[];
  photoUrl?: string | undefined;
  fitSummary: string;
};

export type MatchDetail = MatchCard & {
  fitCards: string[];
  watchouts: string[];
  firstMove: string;
  audio?: {
    id: string;
    status: 'locked' | 'processing' | 'ready';
    durationSeconds?: number;
    url?: string;
  };
};

