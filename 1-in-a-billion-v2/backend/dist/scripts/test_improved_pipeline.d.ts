/**
 * TEST IMPROVED PIPELINE
 *
 * Full end-to-end test: Swiss Ephemeris → Chart Data → Portrait (Gemini Pro) →
 * Trigger + Writing (improved pipeline) → PDF with portrait embedded.
 *
 * All 4 quality fixes applied:
 *   Fix 1: Full chart data (no stripping)
 *   Fix 2: Style-specific system prompt (spicy_surreal)
 *   Fix 3: Chart-aware provocations (anchored to actual placements)
 *   Fix 4: Dead code removed
 *
 * Portrait uses Google Gemini 3 Pro Image (not Flash).
 *
 * Usage:
 *   npx tsx src/scripts/test_improved_pipeline.ts                    # Tata + western
 *   npx tsx src/scripts/test_improved_pipeline.ts --person=michael    # specific person
 *   npx tsx src/scripts/test_improved_pipeline.ts --system=vedic      # specific system
 *   npx tsx src/scripts/test_improved_pipeline.ts --person=tata --all-systems
 *   npx tsx src/scripts/test_improved_pipeline.ts --skip-portrait     # text+PDF only, no portrait
 */
export {};
//# sourceMappingURL=test_improved_pipeline.d.ts.map