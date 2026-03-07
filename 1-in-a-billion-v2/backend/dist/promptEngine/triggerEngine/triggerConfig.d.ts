/**
 * Single source of truth for shared narrative-trigger language.
 * Change once here, affects all trigger-engine prompts across systems.
 */
export type TriggerType = 'wound' | 'core-conflict' | 'soul-knot';
export type TriggerStyle = 'single' | 'blended';
/**
 * Global trigger selector (single source of truth).
 * Override without code edits via env:
 * - NARRATIVE_TRIGGER_TYPE=wound|core-conflict|soul-knot
 * - NARRATIVE_TRIGGER_STYLE=single|blended
 */
export declare const NARRATIVE_TRIGGER_TYPE: TriggerType;
export declare const NARRATIVE_TRIGGER_STYLE: TriggerStyle;
export declare const NARRATIVE_TRIGGER_LABEL: string;
export declare const NARRATIVE_TRIGGER_TITLE: string;
export declare const RELATIONAL_TRIGGER_LABEL: string;
export declare const RELATIONAL_TRIGGER_TITLE: string;
export declare const NARRATIVE_TRIGGER_VARIATION_RULE = "Vary trigger vocabulary naturally across the reading: wound, core conflict, soul knot, fracture, pressure point. Do not repeat one keyword as a refrain.";
export declare const CORE_FAIRYTALE_SEED: string;
/**
 * Overlay-specific narrative seed.
 * Shared across all synastry/overlay writing prompts.
 */
export declare const CORE_FAIRYTALE_SEED_OVERLAY: string;
//# sourceMappingURL=triggerConfig.d.ts.map