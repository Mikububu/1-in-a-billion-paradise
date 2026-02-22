/**
 * STRUCTURES INDEX
 * 
 * Exports all reading structure modules.
 */

export * from './individual';
export * from './overlay';
export * from './nuclear';

export type ReadingType = 'individual' | 'overlay' | 'nuclear';

export const READING_CONFIGS = {
  individual: {
    totalWords: 8000,
    audioMinutes: 60,
    apiCalls: 1,
  },
  overlay: {
    totalWords: 12000,
    audioMinutes: 90,
    apiCalls: 2,
  },
  nuclear: {
    totalWords: 30000,
    audioMinutes: 150,
    apiCalls: 5,
  },
};
