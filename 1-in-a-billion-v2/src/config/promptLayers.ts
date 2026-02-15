export type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

export type PromptLayerConfig = {
    individualLayerId: string;
    synastryLayerId: string;
    analysisVersion: string;
};

export type PromptLayerDirective = {
    policyVersion: string;
    sharedWritingStyleLayerId: string;
    finalVerdictLayerId: string;
    kabbalahNameGematriaMode: 'disabled';
    systems: Partial<Record<ReadingSystem, PromptLayerConfig>>;
};

export const PROMPT_LAYER_POLICY_VERSION = '2026-02-layered-5x2-plus-verdict';
export const SHARED_WRITING_STYLE_LAYER_ID = 'writing-style-guide-spicy-surreal-v2';
export const FINAL_VERDICT_LAYER_ID = 'final-verdict-v1';

export const SYSTEM_ANALYSIS_LAYERS: Record<ReadingSystem, PromptLayerConfig> = {
    western: {
        individualLayerId: 'hellenistic-individual-v1',
        synastryLayerId: 'hellenistic-synastry-v1',
        analysisVersion: 'v1',
    },
    vedic: {
        individualLayerId: 'vedic-individual-v1',
        synastryLayerId: 'vedic-synastry-v1',
        analysisVersion: 'v1',
    },
    human_design: {
        individualLayerId: 'human-design-individual-v1',
        synastryLayerId: 'human-design-synastry-v1',
        analysisVersion: 'v1',
    },
    gene_keys: {
        individualLayerId: 'gene-keys-individual-v1',
        synastryLayerId: 'gene-keys-synastry-v1',
        analysisVersion: 'v1',
    },
    kabbalah: {
        individualLayerId: 'kabbalah-individual-v2',
        synastryLayerId: 'kabbalah-synastry-v2',
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
        finalVerdictLayerId: FINAL_VERDICT_LAYER_ID,
        kabbalahNameGematriaMode: 'disabled',
        systems: layerMap,
    };
}
