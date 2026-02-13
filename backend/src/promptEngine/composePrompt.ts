import { loadLayerMarkdown } from './layerLoader';
import { STYLE_LAYER_REGISTRY, SYSTEM_LAYER_REGISTRY } from './layerRegistry';
import {
    ComposePromptInput,
    ComposePromptResult,
    PromptLayerDiagnostics,
    PromptLayerDirective,
    SystemId,
} from './types';

const LAYER_BUDGET = {
    globalStyle: 12000,
    systemKnowledge: 20000,
    modeRules: 1800,
    context: 2800,
    chartData: 30000,
    outputLanguage: 250,
} as const;

function uniqueSystems(systems: SystemId[]): SystemId[] {
    return Array.from(new Set(systems));
}

function capLayer(
    name: string,
    content: string,
    maxChars: number,
    stats: PromptLayerDiagnostics[]
): string {
    const normalized = String(content || '').trim();
    if (!normalized) {
        stats.push({
            name,
            sourceChars: 0,
            finalChars: 0,
            maxChars,
            truncated: false,
        });
        return '';
    }

    if (normalized.length <= maxChars) {
        stats.push({
            name,
            sourceChars: normalized.length,
            finalChars: normalized.length,
            maxChars,
            truncated: false,
        });
        return normalized;
    }

    const truncated = `${normalized.slice(0, maxChars).trimEnd()}\n\n[${name.toUpperCase()} TRUNCATED FOR TOKEN SAFETY]`;
    stats.push({
        name,
        sourceChars: normalized.length,
        finalChars: truncated.length,
        maxChars,
        truncated: true,
    });
    return truncated;
}

function resolveStyleLayerId(directive?: PromptLayerDirective): string {
    const requested = directive?.sharedWritingStyleLayerId;
    if (requested && STYLE_LAYER_REGISTRY.files[requested]) {
        return requested;
    }
    return STYLE_LAYER_REGISTRY.defaultLayerId;
}

function resolveSystemLayerId(system: SystemId, directive?: PromptLayerDirective): string {
    const requested = directive?.systems?.[system]?.analysisLayerId;
    if (requested && SYSTEM_LAYER_REGISTRY[system].files[requested]) {
        return requested;
    }
    return SYSTEM_LAYER_REGISTRY[system].defaultLayerId;
}

function modeRules(readingKind: ComposePromptInput['readingKind']): string {
    if (readingKind === 'overlay') {
        return [
            'READING MODE: OVERLAY',
            '- Focus on dynamic interaction, conflict loops, repair loops, and compatibility architecture.',
            '- Name who tends to pursue, withdraw, control, or soften under stress.',
            '- Do not flatten the bond into generic romance language.',
        ].join('\n');
    }

    if (readingKind === 'nuclear') {
        return [
            'READING MODE: NUCLEAR (MULTI-SYSTEM SYNTHESIS)',
            '- Synthesize all selected systems into one coherent narrative.',
            '- Do not output five separate mini-readings.',
            '- Name where systems agree, where they tension each other, and the final practical guidance.',
        ].join('\n');
    }

    return [
        'READING MODE: INDIVIDUAL',
        '- Build a complete portrait of one person.',
        '- Keep claims concrete and behavior-linked.',
    ].join('\n');
}

function buildSystemBlock(
    systems: SystemId[],
    directive: PromptLayerDirective | undefined,
    stats: PromptLayerDiagnostics[]
): { text: string; ids: Array<{ system: SystemId; layerId: string }> } {
    const systemIds: Array<{ system: SystemId; layerId: string }> = [];
    const sections: string[] = [];

    systems.forEach((system) => {
        const layerId = resolveSystemLayerId(system, directive);
        const file = SYSTEM_LAYER_REGISTRY[system].files[layerId];
        const raw = loadLayerMarkdown(file);
        const layer = capLayer(`system:${system}:${layerId}`, raw, LAYER_BUDGET.systemKnowledge, stats);

        systemIds.push({ system, layerId });
        sections.push(`SYSTEM ANALYSIS KNOWLEDGE (${system.toUpperCase()} | ${layerId})\n${layer}`);
    });

    return {
        text: sections.join('\n\n'),
        ids: systemIds,
    };
}

export function composePrompt(input: ComposePromptInput): ComposePromptResult {
    const systems = uniqueSystems(input.systems || []);
    if (systems.length === 0) {
        throw new Error('composePrompt requires at least one system');
    }

    if (input.readingKind !== 'individual' && !input.person2Name) {
        throw new Error(`${input.readingKind} reading requires person2Name`);
    }

    const stats: PromptLayerDiagnostics[] = [];
    const directive = input.promptLayerDirective;

    const styleLayerId = resolveStyleLayerId(directive);
    const styleRaw = loadLayerMarkdown(STYLE_LAYER_REGISTRY.files[styleLayerId]);
    const styleLayer = capLayer('global-style', styleRaw, LAYER_BUDGET.globalStyle, stats);

    const systemsBlock = buildSystemBlock(systems, directive, stats);
    const modeLayer = capLayer('mode-rules', modeRules(input.readingKind), LAYER_BUDGET.modeRules, stats);

    const contextRaw = input.readingKind === 'overlay' || input.readingKind === 'nuclear'
        ? input.relationshipContext || ''
        : input.personalContext || '';
    const contextLayer = capLayer('context', contextRaw, LAYER_BUDGET.context, stats);

    const chartLayer = capLayer('chart-data', input.chartData, LAYER_BUDGET.chartData, stats);

    const outputLanguageLayer = capLayer(
        'output-language',
        input.outputLanguage ? `OUTPUT LANGUAGE: ${input.outputLanguage}` : '',
        LAYER_BUDGET.outputLanguage,
        stats
    );

    const kabbalahPolicyLine = systems.includes('kabbalah')
        ? `KABBALAH NAME/GEMATRIA MODE: ${directive?.kabbalahNameGematriaMode || 'disabled'}`
        : '';

    const prompt = [
        `GLOBAL WRITING STYLE LAYER (${styleLayerId})`,
        styleLayer,
        systemsBlock.text,
        modeLayer,
        `SUBJECTS:\n- Person 1: ${input.person1Name}${input.person2Name ? `\n- Person 2: ${input.person2Name}` : ''}`,
        kabbalahPolicyLine,
        contextLayer ? `CONTEXT:\n${contextLayer}` : '',
        outputLanguageLayer,
        `CHART DATA:\n${chartLayer}`,
        'FINAL OUTPUT REQUIREMENT: Return only the reading prose. No markdown. No bullet lists.',
    ]
        .filter(Boolean)
        .join('\n\n');

    return {
        prompt,
        diagnostics: {
            styleLayerId,
            systemLayerIds: systemsBlock.ids,
            totalChars: prompt.length,
            layerStats: stats,
        },
    };
}
