/**
 * CENTRALIZED FEATURE FLAGS
 * 
 * Change settings HERE and they apply EVERYWHERE in the app.
 * No more hunting through multiple files!
 */

export const FEATURES = {
  // ═══════════════════════════════════════════════════════════════
  // AUDIO / TTS SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  /** Enable/disable Chatterbox TTS via RunPod (voice cloning!) */
  CHATTERBOX_ENABLED: true,
  
  /** Default TTS provider: 'chatterbox' | 'none' */
  DEFAULT_TTS_PROVIDER: 'chatterbox' as 'chatterbox' | 'none',
  
  /** Auto-generate audio when reading completes */
  AUTO_GENERATE_AUDIO: true,
  
  // ═══════════════════════════════════════════════════════════════
  // PDF SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  /** Auto-generate PDF when reading completes */
  AUTO_GENERATE_PDF: true,
  
  /** PDF version string */
  PDF_VERSION: 'v1.0',
  
  // ═══════════════════════════════════════════════════════════════
  // DEV / DEBUG SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  /** Enable dev mode shortcuts (triple-tap to skip, etc.) */
  DEV_MODE: __DEV__,
  
  /** Skip directly to reading screen in dev mode */
  DEV_SKIP_TO_READING: false,
  
  /** Show debug logs in console */
  DEBUG_LOGS: __DEV__,
  
  /** Mock API responses instead of real calls */
  MOCK_API: false,

  // ═══════════════════════════════════════════════════════════════
  // EXPORT / DOWNLOAD
  // ═══════════════════════════════════════════════════════════════

  /** Enable "Download all (ZIP)" export buttons for completed jobs */
  ZIP_EXPORT_ENABLED: true,
};

// Type export for autocomplete
export type FeatureFlags = typeof FEATURES;



