/**
 * CORE TYPES
 * 
 * Shared type definitions for the backend.
 */

import { OutputLanguage } from './config/languages';

// Re-export for convenience
export type { OutputLanguage };

export type RelationshipMode = 'family' | 'sensual';

export type ReadingPayload = {
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
  relationshipIntensity: number;
  relationshipMode: RelationshipMode;
  primaryLanguage: string;      // User's spoken language preference
  secondaryLanguage?: string;
  subjectName?: string;
  isPartnerReading?: boolean;
  outputLanguage?: OutputLanguage;  // Language for generated content (defaults to 'en')
};

export type HookReading = {
  type: 'sun' | 'moon' | 'rising';
  sign: string;
  intro: string;
  main: string;
};

export type Placements = {
  sunSign: string;
  sunDegree?: string;
  moonSign: string;
  moonDegree?: string;
  risingSign: string;
  risingDegree?: string;
};

export type ReadingResponse = {
  reading: HookReading;
  placements?: Placements;
  metadata: {
    cacheHit: boolean;
    generatedAt: string;
    source: 'deepseek' | 'fallback';
    outputLanguage?: OutputLanguage;  // Track what language was generated
  };
};

export type MatchCard = {
  id: string;
  name: string;
  age: number;
  city: string;
  score: number;
  tags: string[];
  photoUrl?: string;
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

/**
 * Job parameters for reading generation.
 * This is stored in jobs.params JSONB column.
 */
export type JobParams = {
  person1: {
    id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
  };
  person2?: {
    id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
  };
  systems: string[];
  spiceLevel: number;
  voiceId?: string;
  audioUrl?: string;
  relationshipContext?: string;
  personalContext?: string;
  outputLanguage: OutputLanguage;  // Required - defaults handled at creation
};
