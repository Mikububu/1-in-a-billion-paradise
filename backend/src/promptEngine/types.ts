export type SystemId = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

export type ReadingKind = 'individual' | 'synastry' | 'verdict';

export type LayerMode = 'individual' | 'synastry';

export type PromptLayerConfig = {
    individualLayerId?: string;
    synastryLayerId?: string;
    analysisVersion?: string;
};

export type PromptLayerDirective = {
    policyVersion?: string;
    sharedWritingStyleLayerId?: string;
    finalVerdictLayerId?: string;
    kabbalahNameGematriaMode?: 'disabled' | 'supporting' | 'enabled';
    systems?: Partial<Record<SystemId, PromptLayerConfig>>;
};

export type ComposePromptInput = {
    readingKind: ReadingKind;
    systems: SystemId[];
    person1Name: string;
    person2Name?: string;
    chartData: string;
    relationshipPreferenceScale?: number;
    personalContext?: string;
    relationshipContext?: string;
    outputLanguage?: string;
    promptLayerDirective?: PromptLayerDirective;
};

export type PromptLayerDiagnostics = {
    name: string;
    sourceChars: number;
    finalChars: number;
    maxChars: number;
    truncated: boolean;
};

export type ComposePromptResult = {
    prompt: string;
    diagnostics: {
        styleLayerId: string;
        systemLayerIds: Array<{ system: SystemId; layerId: string; mode: LayerMode }>;
        verdictLayerId?: string;
        totalChars: number;
        layerStats: PromptLayerDiagnostics[];
    };
};
