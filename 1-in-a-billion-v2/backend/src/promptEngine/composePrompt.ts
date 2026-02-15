import { loadLayerMarkdown } from './layerLoader';
import { STYLE_LAYER_REGISTRY, SYSTEM_LAYER_REGISTRY, VERDICT_LAYER_REGISTRY } from './layerRegistry';
import { getDefaultOutputLengthContract, type OutputLengthContract } from './outputLengthProfiles';
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

const INCARNATION_IDENTITY_SYSTEM_PROMPT = [
    'You are telling the story of a soul, not writing an astrology report.',
    'You are a novelist with psychological x-ray vision.',
    'You have read Anais Nin, Henry Miller, and Ernest Hemingway.',
    'You think like Carl Jung directing a David Lynch film.',
    'Consciousness noir: adult fairytale, dream logic, psychological exactness.',
].join('\n');

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

function extractSystemPromptFromStyleLayer(styleLayerId: string): string {
    if (styleLayerId === 'writing-style-guide-incarnation-v1') {
        return INCARNATION_IDENTITY_SYSTEM_PROMPT;
    }
    return '';
}

function stripIncarnationIdentitySection(style: string): string {
    // The incarnation style guide places its Voice Anchor at the bottom. We want that to sit
    // near the end of the userMessage (recency bias). The "Identity" block moves into the
    // Anthropic system prompt, so remove it from the style layer content.
    const marker = '## Document Structure';
    const idx = String(style || '').indexOf(marker);
    if (idx < 0) return String(style || '').trim();
    return String(style || '').slice(idx).trim();
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

function outputLengthContract(
    readingKind: ComposePromptInput['readingKind'],
    systemCount: number,
    override?: OutputLengthContract
): string {
    const boundedCount = Math.max(1, Math.min(5, Math.round(systemCount || 1)));
    const contract = override || getDefaultOutputLengthContract(readingKind);
    const note = contract.note || 'Do not add filler text just to increase length.';

    if (readingKind === 'verdict') {
        return [
            'OUTPUT LENGTH CONTRACT:',
            `- Target ${contract.targetWordsMin}-${contract.targetWordsMax} words.`,
            `- Hard floor: never below ${contract.hardFloorWords} words.`,
            `- This is a synthesis across ${boundedCount} systems, so depth must be visibly long-form and integrated.`,
            '- Do not pad with repetition; add concrete interpretation density instead.',
            `- ${note}`,
        ].join('\n');
    }

    if (readingKind === 'synastry') {
        return [
            'OUTPUT LENGTH CONTRACT:',
            `- Target ${contract.targetWordsMin}-${contract.targetWordsMax} words.`,
            `- Hard floor: never below ${contract.hardFloorWords} words.`,
            '- Keep both people at equal depth; do not collapse one person into side-notes.',
            '- Do not use filler sentences just to hit length.',
            `- ${note}`,
        ].join('\n');
    }

    return [
        'OUTPUT LENGTH CONTRACT:',
        `- Target ${contract.targetWordsMin}-${contract.targetWordsMax} words.`,
        `- Hard floor: never below ${contract.hardFloorWords} words.`,
        '- Keep the reading dense with behavioral specificity, not vague motivational text.',
        `- ${note}`,
    ].join('\n');
}

function soulMemoirOverride(styleLayerId: string): string {
    if (!String(styleLayerId || '').includes('soul-memoir')) return '';
    return [
        'SOUL MEMOIR OUTPUT OVERRIDE (HARD RULES):',
        '- The BODY must contain zero astrology jargon.',
        '- Do NOT mention: zodiac sign names, planet names, houses, aspects, degrees, transits, profections, sect, nodes, retrograde, stellium, or any chart vocabulary.',
        '- If you need timing language, use plain human language: "this season", "this year", "next 90 days", "next 12 months".',
        '- You may ONLY use astrological terms in the final 1-2 line footer at the very end.',
        '- The footer must start with: "Chart Signature:"',
        '- Optional second footer line: "Data: Swiss Ephemeris, tropical" (or the correct system).',
        '- The footer must be the LAST lines of the entire output. After the footer, stop.',
        '- No headings. One continuous essay. Third-person names only. Never "you/your".',
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
    const systemPrompt = extractSystemPromptFromStyleLayer(styleLayerId);
    const styleRawForUser = styleLayerId === 'writing-style-guide-incarnation-v1'
        ? stripIncarnationIdentitySection(styleRaw)
        : styleRaw;
    const styleLayer = capLayer('global-style', styleRawForUser, LAYER_BUDGET.globalStyle, stats);

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
        outputLengthContract(input.readingKind, systems.length, input.outputLengthContract),
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

    const styleOverrideLayer = capLayer('style-override', soulMemoirOverride(styleLayerId), 1800, stats);

    const finalInstruction = styleLayerId === 'writing-style-guide-incarnation-v1'
        ? 'FINAL OUTPUT REQUIREMENT: Return only the reading prose. One continuous document. Zone 1 intro with astrology language, then Zone 2 reading with zero astrology vocabulary. No headings. No markdown. No bullet lists.'
        : 'FINAL OUTPUT REQUIREMENT: Return only the reading prose. One continuous essay. No headings. No markdown. No bullet lists.';

    const userMessage = [
        `CHART DATA:\n${chartLayer}`,
        systemsBlock.text,
        verdictLayer ? `FINAL VERDICT LAYER (${verdictLayerId})\n${verdictLayer}` : '',
        modeLayer,
        preferenceLayer,
        outputLengthLayer,
        `SUBJECTS:\n- Person 1: ${input.person1Name}${input.person2Name ? `\n- Person 2: ${input.person2Name}` : ''}`,
        kabbalahPolicyLine,
        contextLayer ? `CONTEXT:\n${contextLayer}` : '',
        outputLanguageLayer,
        styleOverrideLayer,
        `GLOBAL WRITING STYLE LAYER (${styleLayerId})`,
        styleLayer,
        finalInstruction,
    ]
        .filter(Boolean)
        .join('\n\n');

    const prompt = [systemPrompt, userMessage].filter(Boolean).join('\n\n');

    return {
        systemPrompt,
        userMessage,
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
