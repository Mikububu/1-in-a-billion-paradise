/**
 * APP-WIDE CONSTANTS
 *
 * Replaces magic numbers scattered throughout the codebase.
 */

// ── Timing ──────────────────────────────────────────────────────────
export const CAROUSEL_INTERVAL_MS = 10_000;
export const ANIMATION_FADE_DURATION_MS = 300;
export const PULSE_ANIMATION_DURATION_MS = 2_000;
export const SHIMMER_ANIMATION_DURATION_MS = 1_500;
export const API_TIMEOUT_MS = 20_000;
export const SUPABASE_TIMEOUT_MS = 60_000;
export const SESSION_HYDRATION_TIMEOUT_MS = 5_000;
export const DEBOUNCE_DELAY_MS = 300;
export const AUDIO_TIMEOUT_MS = 240_000; // 4 minutes

// ── Layout ──────────────────────────────────────────────────────────
export const COMPACT_SCREEN_THRESHOLD = 700;
export const SMALL_SCREEN_THRESHOLD = 375;
export const MAX_CONTENT_WIDTH = 500;

// ── Limits ──────────────────────────────────────────────────────────
export const MAX_PEOPLE_LIBRARY_SIZE = 50;
export const MAX_NAME_LENGTH = 50;
export const MAX_CITY_QUERY_LENGTH = 100;
export const MAX_CHAT_MESSAGE_LENGTH = 2_000;

// ── Cache ───────────────────────────────────────────────────────────
export const QUERY_STALE_TIME_MS = 5 * 60_000;    // 5 minutes
export const QUERY_GC_TIME_MS = 10 * 60_000;      // 10 minutes
export const QUERY_RETRY_COUNT = 2;

// ── Colors (repeated in many files) ────────────────────────────────
export const COLORS = {
  background: '#0a0a0a',
  surface: '#141414',
  surfaceLight: '#1a1a1a',
  gold: '#c9a94e',
  goldLight: '#d4b85c',
  textPrimary: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#666666',
  error: '#ff6b6b',
  success: '#4ecdc4',
  border: '#333333',
} as const;
