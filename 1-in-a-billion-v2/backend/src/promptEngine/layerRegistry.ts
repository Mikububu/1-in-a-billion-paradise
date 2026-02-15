import { SystemId } from './types';

export const STYLE_LAYER_REGISTRY = {
    defaultLayerId: 'writing-style-guide-v1',
    files: {
        'writing-style-guide-v1': 'style/writing-style-guide.md',
        'writing-style-guide-production-v1': 'style/writing-style-guide-production.md',
        'writing-style-guide-production-v2': 'style/writing-style-guide-production-v2.md',
        'writing-style-guide-production-v3': 'style/writing-style-guide-production-v3.md',
        'writing-style-guide-spicy-surreal-v1': 'style/writing-style-guide-spicy-surreal.md',
        'writing-style-guide-spicy-surreal-v2': 'style/writing-style-guide-spicy-surreal-v2.md',
        'writing-style-guide-soul-memoir-v1': 'style/writing-style-guide-soul-memoir.md',
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
        defaultIndividualLayerId: 'hellenistic-individual-incarnation-v1',
        defaultSynastryLayerId: 'hellenistic-synastry-v1',
        files: {
            'hellenistic-individual-v1': 'systems/hellenistic-individual.md',
            'hellenistic-individual-incarnation-v1': 'systems/hellenistic-individual-incarnation.md',
            'hellenistic-synastry-v1': 'systems/hellenistic-synastry.md',
        },
    },
    vedic: {
        defaultIndividualLayerId: 'vedic-individual-v1',
        defaultSynastryLayerId: 'vedic-synastry-v1',
        files: {
            'vedic-individual-v1': 'systems/vedic-individual.md',
            'vedic-synastry-v1': 'systems/vedic-synastry.md',
        },
    },
    human_design: {
        defaultIndividualLayerId: 'human-design-individual-v1',
        defaultSynastryLayerId: 'human-design-synastry-v1',
        files: {
            'human-design-individual-v1': 'systems/human-design-individual.md',
            'human-design-synastry-v1': 'systems/human-design-synastry.md',
        },
    },
    gene_keys: {
        defaultIndividualLayerId: 'gene-keys-individual-v1',
        defaultSynastryLayerId: 'gene-keys-synastry-v1',
        files: {
            'gene-keys-individual-v1': 'systems/gene-keys-individual.md',
            'gene-keys-synastry-v1': 'systems/gene-keys-synastry.md',
        },
    },
    kabbalah: {
        defaultIndividualLayerId: 'kabbalah-individual-v2',
        defaultSynastryLayerId: 'kabbalah-synastry-v2',
        files: {
            'kabbalah-individual-v2': 'systems/kabbalah-individual.md',
            'kabbalah-synastry-v2': 'systems/kabbalah-synastry.md',
        },
    },
};

export const VERDICT_LAYER_REGISTRY = {
    defaultLayerId: 'final-verdict-v1',
    files: {
        'final-verdict-v1': 'verdict/final-verdict.md',
    } as Record<string, string>,
};
