import { SystemId } from './types';

export const STYLE_LAYER_REGISTRY = {
    defaultLayerId: 'writing-style-guide-v1',
    files: {
        'writing-style-guide-v1': 'style/writing-style-guide.md',
        // Legacy alias
        'shared-astro-fairytale-style-v1': 'style/writing-style-guide.md',
    } as Record<string, string>,
};

export const SYSTEM_LAYER_REGISTRY: Record<
    SystemId,
    {
        defaultIndividualLayerId: string;
        defaultSynastryLayerId: string;
        files: Record<string, string>;
    }
> = {
    western: {
        defaultIndividualLayerId: 'western-individual-v1',
        defaultSynastryLayerId: 'western-synastry-v1',
        files: {
            'western-individual-v1': 'systems/western-individual.md',
            'western-synastry-v1': 'systems/western-synastry.md',
            // Legacy alias
            'western-analysis-v1': 'systems/western-individual.md',
        },
    },
    vedic: {
        defaultIndividualLayerId: 'vedic-individual-v1',
        defaultSynastryLayerId: 'vedic-synastry-v1',
        files: {
            'vedic-individual-v1': 'systems/vedic-individual.md',
            'vedic-synastry-v1': 'systems/vedic-synastry.md',
            // Legacy alias
            'vedic-analysis-v1': 'systems/vedic-individual.md',
        },
    },
    human_design: {
        defaultIndividualLayerId: 'human-design-individual-v1',
        defaultSynastryLayerId: 'human-design-synastry-v1',
        files: {
            'human-design-individual-v1': 'systems/human-design-individual.md',
            'human-design-synastry-v1': 'systems/human-design-synastry.md',
            // Legacy alias
            'human-design-analysis-v1': 'systems/human-design-individual.md',
        },
    },
    gene_keys: {
        defaultIndividualLayerId: 'gene-keys-individual-v1',
        defaultSynastryLayerId: 'gene-keys-synastry-v1',
        files: {
            'gene-keys-individual-v1': 'systems/gene-keys-individual.md',
            'gene-keys-synastry-v1': 'systems/gene-keys-synastry.md',
            // Legacy alias
            'gene-keys-analysis-v1': 'systems/gene-keys-individual.md',
        },
    },
    kabbalah: {
        defaultIndividualLayerId: 'kabbalah-individual-v2',
        defaultSynastryLayerId: 'kabbalah-synastry-v2',
        files: {
            'kabbalah-individual-v2': 'systems/kabbalah-individual.md',
            'kabbalah-synastry-v2': 'systems/kabbalah-synastry.md',
            // Legacy alias
            'kabbalah-analysis-v2-no-name-gematria': 'systems/kabbalah-individual.md',
        },
    },
};

export const VERDICT_LAYER_REGISTRY = {
    defaultLayerId: 'final-verdict-v1',
    files: {
        'final-verdict-v1': 'verdict/final-verdict.md',
    } as Record<string, string>,
};
