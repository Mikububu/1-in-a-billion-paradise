import { SystemId } from './types';

export const STYLE_LAYER_REGISTRY = {
    defaultLayerId: 'shared-astro-fairytale-style-v1',
    files: {
        'shared-astro-fairytale-style-v1': 'style/shared-astro-fairytale-style-v1.md',
    } as Record<string, string>,
};

export const SYSTEM_LAYER_REGISTRY: Record<
    SystemId,
    {
        defaultLayerId: string;
        files: Record<string, string>;
    }
> = {
    western: {
        defaultLayerId: 'western-analysis-v1',
        files: {
            'western-analysis-v1': 'systems/western-analysis-v1.md',
        },
    },
    vedic: {
        defaultLayerId: 'vedic-analysis-v1',
        files: {
            'vedic-analysis-v1': 'systems/vedic-analysis-v1.md',
        },
    },
    human_design: {
        defaultLayerId: 'human-design-analysis-v1',
        files: {
            'human-design-analysis-v1': 'systems/human-design-analysis-v1.md',
        },
    },
    gene_keys: {
        defaultLayerId: 'gene-keys-analysis-v1',
        files: {
            'gene-keys-analysis-v1': 'systems/gene-keys-analysis-v1.md',
        },
    },
    kabbalah: {
        defaultLayerId: 'kabbalah-analysis-v2-no-name-gematria',
        files: {
            'kabbalah-analysis-v2-no-name-gematria': 'systems/kabbalah-analysis-v2-no-name-gematria.md',
        },
    },
};
