import { loadLayerMarkdown } from './layerLoader';
import { STYLE_LAYER_REGISTRY, SYSTEM_LAYER_REGISTRY, VERDICT_LAYER_REGISTRY } from './layerRegistry';
import {
    ComposePromptInput,
    ComposePromptResult,
    LayerMode,
    PromptLayerDiagnostics,
    PromptLayerDirective,
    SystemId,
} from './types';

const LAYER_BUDGET = {
    globalStyle: 12000,
    systemKnowledge: 20000,
    modeRules: 1800,
    preferenceLens: 1400,
    outputLength: 700,
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

function resolveVerdictLayerId(directive?: PromptLayerDirective): string {
    const requested = directive?.finalVerdictLayerId;
    if (requested && VERDICT_LAYER_REGISTRY.files[requested]) {
        return requested;
    }
    return VERDICT_LAYER_REGISTRY.defaultLayerId;
}

function layerModeFromReadingKind(readingKind: ComposePromptInput['readingKind']): LayerMode {
    return readingKind === 'individual' ? 'individual' : 'synastry';
}

function resolveSystemLayerId(
    system: SystemId,
    readingKind: ComposePromptInput['readingKind'],
    directive?: PromptLayerDirective
): { layerId: string; mode: LayerMode } {
    const registry = SYSTEM_LAYER_REGISTRY[system];
    const mode = layerModeFromReadingKind(readingKind);
    const systemDirective = directive?.systems?.[system];
    const requestedByMode = mode === 'individual'
        ? systemDirective?.individualLayerId
        : systemDirective?.synastryLayerId;

    if (requestedByMode && registry.files[requestedByMode]) {
        return { layerId: requestedByMode, mode };
    }

    return {
        layerId: mode === 'individual'
            ? registry.defaultIndividualLayerId
            : registry.defaultSynastryLayerId,
        mode,
    };
}

function modeRules(readingKind: ComposePromptInput['readingKind']): string {
    if (readingKind === 'synastry') {
        return [
            'READING MODE: SYNASTRY',
            '- Focus on dynamic interaction, conflict loops, repair loops, and compatibility architecture.',
            '- Name who tends to pursue, withdraw, control, or soften under stress.',
            '- Do not flatten the bond into generic romance language.',
        ].join('\n');
    }

    if (readingKind === 'verdict') {
        return [
            'READING MODE: VERDICT (BUNDLE SYNTHESIS)',
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

function preferenceBand(level: number): string {
    if (level <= 2) return 'stability-first (safe, grounded, low-chaos)';
    if (level <= 4) return 'gentle depth (emotionally warm, not extreme)';
    if (level <= 6) return 'balanced intensity (depth plus friction tolerance)';
    if (level <= 8) return 'high intensity (transformative, shadow-facing dynamics)';
    return 'extreme intensity (edge, obsession-risk, high-voltage bonds)';
}

function preferenceLens(readingKind: ComposePromptInput['readingKind'], level?: number): string {
    const clamped = Number.isFinite(level) ? Math.min(10, Math.max(1, Math.round(level as number))) : 5;
    const modeSpecific = readingKind === 'individual'
        ? '- In individual readings, describe which partner dynamic this person will perceive as too safe vs truly alive for their relationship appetite.'
        : '- In synastry/verdict readings, explicitly judge fit-to-preference: state if this bond is too safe, too chaotic, or aligned with the stated appetite.';

    return [
        `RELATIONSHIP PREFERENCE SCALE: ${clamped}/10`,
        `PREFERENCE BAND: ${preferenceBand(clamped)}`,
        '- This is a relationship-desire lens, not a prose-intensity dial.',
        '- Keep writing intensity high by default.',
        '- Interpret compatibility and practical guidance through this lens.',
        modeSpecific,
        '- If mismatch exists, say it directly (for example: exciting but unstable, or secure but too flat).',
    ].join('\n');
}

function outputLengthContract(readingKind: ComposePromptInput['readingKind'], systemCount: number): string {
    const boundedCount = Math.max(1, Math.min(5, Math.round(systemCount || 1)));

    if (readingKind === 'verdict') {
        return [
            'OUTPUT LENGTH CONTRACT:',
            '- Target 1300-1900 words.',
            '- Hard floor: never below 1000 words.',
            `- This is a synthesis across ${boundedCount} systems, so depth must be visibly long-form and integrated.`,
            '- Do not pad with repetition; add concrete interpretation density instead.',
        ].join('\n');
    }

    if (readingKind === 'synastry') {
        return [
            'OUTPUT LENGTH CONTRACT:',
            '- Target 1100-1700 words.',
            '- Hard floor: never below 900 words.',
            '- Keep both people at equal depth; do not collapse one person into side-notes.',
            '- Do not use filler sentences just to hit length.',
        ].join('\n');
    }

    return [
        'OUTPUT LENGTH CONTRACT:',
        '- Target 900-1400 words.',
        '- Hard floor: never below 750 words.',
        '- Keep the reading dense with behavioral specificity, not vague motivational text.',
    ].join('\n');
}

function buildSystemBlock(
    systems: SystemId[],
    readingKind: ComposePromptInput['readingKind'],
    directive: PromptLayerDirective | undefined,
    stats: PromptLayerDiagnostics[]
): { text: string; ids: Array<{ system: SystemId; layerId: string; mode: LayerMode }> } {
    const systemIds: Array<{ system: SystemId; layerId: string; mode: LayerMode }> = [];
    const sections: string[] = [];

    systems.forEach((system) => {
        const { layerId, mode } = resolveSystemLayerId(system, readingKind, directive);
        const file = SYSTEM_LAYER_REGISTRY[system].files[layerId];
        const raw = loadLayerMarkdown(file);
        const layer = capLayer(`system:${system}:${layerId}`, raw, LAYER_BUDGET.systemKnowledge, stats);

        systemIds.push({ system, layerId, mode });
        sections.push(`SYSTEM ANALYSIS KNOWLEDGE (${system.toUpperCase()} | ${mode.toUpperCase()} | ${layerId})\n${layer}`);
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

    const systemsBlock = buildSystemBlock(systems, input.readingKind, directive, stats);
    const modeLayer = capLayer('mode-rules', modeRules(input.readingKind), LAYER_BUDGET.modeRules, stats);
    const preferenceLayer = capLayer(
        'preference-lens',
        preferenceLens(input.readingKind, input.relationshipPreferenceScale),
        LAYER_BUDGET.preferenceLens,
        stats
    );
    const outputLengthLayer = capLayer(
        'output-length',
        outputLengthContract(input.readingKind, systems.length),
        LAYER_BUDGET.outputLength,
        stats
    );

    const contextRaw = input.readingKind === 'synastry' || input.readingKind === 'verdict'
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
    const verdictLayerId = input.readingKind === 'verdict' ? resolveVerdictLayerId(directive) : undefined;
    const verdictLayer = verdictLayerId
        ? capLayer('final-verdict-layer', loadLayerMarkdown(VERDICT_LAYER_REGISTRY.files[verdictLayerId]), LAYER_BUDGET.systemKnowledge, stats)
        : '';

    const prompt = [
        `GLOBAL WRITING STYLE LAYER (${styleLayerId})`,
        styleLayer,
        systemsBlock.text,
        modeLayer,
        preferenceLayer,
        outputLengthLayer,
        `SUBJECTS:\n- Person 1: ${input.person1Name}${input.person2Name ? `\n- Person 2: ${input.person2Name}` : ''}`,
        kabbalahPolicyLine,
        contextLayer ? `CONTEXT:\n${contextLayer}` : '',
        verdictLayer ? `FINAL VERDICT LAYER (${verdictLayerId})\n${verdictLayer}` : '',
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
            verdictLayerId,
            totalChars: prompt.length,
            layerStats: stats,
        },
    };
}
