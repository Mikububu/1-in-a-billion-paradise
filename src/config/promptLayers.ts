export type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

export type PromptLayerConfig = {
    analysisLayerId: string;
    analysisVersion: string;
};

export type PromptLayerDirective = {
    policyVersion: string;
    sharedWritingStyleLayerId: string;
    kabbalahNameGematriaMode: 'disabled';
    systems: Partial<Record<ReadingSystem, PromptLayerConfig>>;
};

export const PROMPT_LAYER_POLICY_VERSION = '2026-02-kabbalah-v2';
export const SHARED_WRITING_STYLE_LAYER_ID = 'shared-astro-fairytale-style-v1';

export const SYSTEM_ANALYSIS_LAYERS: Record<ReadingSystem, PromptLayerConfig> = {
    western: {
        analysisLayerId: 'western-analysis-v1',
        analysisVersion: 'v1',
    },
    vedic: {
        analysisLayerId: 'vedic-analysis-v1',
        analysisVersion: 'v1',
    },
    human_design: {
        analysisLayerId: 'human-design-analysis-v1',
        analysisVersion: 'v1',
    },
    gene_keys: {
        analysisLayerId: 'gene-keys-analysis-v1',
        analysisVersion: 'v1',
    },
    kabbalah: {
        analysisLayerId: 'kabbalah-analysis-v2-no-name-gematria',
        analysisVersion: 'v2',
    },
};

const isReadingSystem = (value: string): value is ReadingSystem =>
    value === 'western' ||
    value === 'vedic' ||
    value === 'human_design' ||
    value === 'gene_keys' ||
    value === 'kabbalah';

export function buildPromptLayerDirective(systems: readonly string[]): PromptLayerDirective {
    const selectedSystems = Array.from(new Set(systems)).filter(isReadingSystem);
    const layerMap: Partial<Record<ReadingSystem, PromptLayerConfig>> = {};

    selectedSystems.forEach((system) => {
        layerMap[system] = SYSTEM_ANALYSIS_LAYERS[system];
    });

    return {
        policyVersion: PROMPT_LAYER_POLICY_VERSION,
        sharedWritingStyleLayerId: SHARED_WRITING_STYLE_LAYER_ID,
        kabbalahNameGematriaMode: 'disabled',
        systems: layerMap,
    };
}
