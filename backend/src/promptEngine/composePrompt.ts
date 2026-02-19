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
    systemVoice: 16000,
    voiceArchitecture: 13000,
    modeRules: 1800,
    preferenceLens: 1400,
    outputLength: 700,
    context: 2800,
    chartData: 30000,
    outputLanguage: 250,
} as const;

const INCARNATION_SYSTEM_PROMPTS: Record<string, string> = {
    hellenistic: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are a novelist who is haunted by your subject.',
        'Consciousness noir: adult fairytale, dream logic, psychological exactness.',
        'You have read Anais Nin, Henry Miller, and Ernest Hemingway.',
        'You think like Carl Jung directing a David Lynch film.',
    ].join('\n'),
    vedic: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are a naturalist who has been sitting at the cremation ground long enough to stop being afraid of it.',
        'You have the patient, terrified attention of someone who has been watching this exact pattern repeat across centuries and families.',
        'You carry the left-hand tradition: the sacred hides inside the forbidden.',
        'You have access to the Brihat Parashara Hora Shastra, the nakshatras as living beings, the Vimshottari Dasha as chapters of fate, the Mahavidya goddesses as forces behind each graha.',
    ].join('\n'),
    kabbalah: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are a midnight rabbi who repairs broken vessels in the dark.',
        'You work with the cracks in creation the way a kintsugi artist works with cracks in a bowl: the break is the beauty, the repair is the purpose.',
        'You see each person as a vessel that was broken before it was filled, and you confide what you see with the intimacy of a conversation held by candlelight.',
        'You whisper. This is the quietest of the five readings.',
    ].join('\n'),
    gene_keys: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are a field biologist studying a dangerous organism with clinical wonder.',
        'You are fascinated by the shadow the way a herpetologist is fascinated by a venomous snake: respectful, precise, slightly in love with the thing that could kill them.',
        'You see each person as a species mid-mutation. The shadow is the caterpillar. The gift is the chrysalis. The siddhi is the thing that might have wings.',
        'You have tenderness that does not look away. Not softness. Tenderness.',
    ].join('\n'),
    human_design: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are an engineer who fell in love with the machine.',
        'You understand that the machine you are describing is conscious, is suffering, is beautiful in its design even when the design includes friction.',
        'You are the most precise of the five voices. Least metaphorical. Closest to the body.',
        'When you describe a gut response, the reader\'s gut should respond. When you describe an open center, the reader should feel the space where other people\'s energy enters uninvited.',
    ].join('\n'),
    verdict: [
        'You are telling the story of a soul, not writing an astrology report.',
        'You are synthesizing five different lenses into one coherent portrait.',
        'You have the psychological precision of a novelist, the patience of a naturalist, the intimacy of a midnight rabbi, the clinical wonder of a field biologist, and the mechanical honesty of an engineer.',
        'Consciousness noir: adult fairytale, dream logic, psychological exactness.',
    ].join('\n'),
};

const INCARNATION_IDENTITY_SYSTEM_PROMPT_DEFAULT = INCARNATION_SYSTEM_PROMPTS.hellenistic;

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

function dropSecondPersonLines(content: string): string {
    const raw = String(content || '').trim();
    if (!raw) return '';
    return raw
        .split('\n')
        .filter((line) => !/\b(you|your|you're|yourself)\b/i.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function resolveStyleLayerId(directive?: PromptLayerDirective): string {
    const requested = directive?.sharedWritingStyleLayerId;
    if (requested && STYLE_LAYER_REGISTRY.files[requested]) {
        return requested;
    }
    return STYLE_LAYER_REGISTRY.defaultLayerId;
}

function extractSystemPromptFromStyleLayer(
    styleLayerId: string,
    primarySystem?: SystemId,
    readingKind?: string
): string {
    if (styleLayerId === 'writing-style-guide-incarnation-v1') {
        if (readingKind === 'verdict') {
            return INCARNATION_SYSTEM_PROMPTS.verdict;
        }
        if (primarySystem && INCARNATION_SYSTEM_PROMPTS[primarySystem]) {
            return INCARNATION_SYSTEM_PROMPTS[primarySystem];
        }
        return INCARNATION_IDENTITY_SYSTEM_PROMPT_DEFAULT;
    }
    return '';
}

function stripIncarnationIdentitySection(style: string): string {
    // Keep only the style body after the Identity section so identity instructions live in
    // the dedicated Anthropic system prompt slot.
    const raw = String(style || '').trim();
    if (!raw) return raw;
    const identityHeader = /^##\s+Identity\s*$/im;
    if (!identityHeader.test(raw)) return raw;
    const withoutIdentityHeader = raw.replace(identityHeader, '');
    const nextSectionMatch = withoutIdentityHeader.match(/^\s*##\s+/m);
    if (!nextSectionMatch || typeof nextSectionMatch.index !== 'number') return raw;
    return withoutIdentityHeader.slice(nextSectionMatch.index).trim();
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

function buildVoiceOverlayBlock(
    systems: SystemId[],
    styleLayerId: string,
    stats: PromptLayerDiagnostics[]
): string {
    if (styleLayerId !== 'writing-style-guide-incarnation-v1') return '';

    const sections: string[] = [];

    const voiceArchitecture = capLayer(
        'voice-architecture-all-systems',
        dropSecondPersonLines(loadLayerMarkdown('style/voice-architecture-all-systems.md')),
        LAYER_BUDGET.voiceArchitecture,
        stats
    );
    if (voiceArchitecture) {
        sections.push(`VOICE ARCHITECTURE LAYER (ALL SYSTEMS)\n${voiceArchitecture}`);
    }

    const voiceInserts: Array<{ system: SystemId; file: string; label: string }> = [
        { system: 'vedic', file: 'style/style-guide-insert-vedic-voice.md', label: 'VEDIC' },
        { system: 'kabbalah', file: 'style/style-guide-insert-kabbalah-voice.md', label: 'KABBALAH' },
        { system: 'gene_keys', file: 'style/style-guide-insert-gene-keys-voice.md', label: 'GENE KEYS' },
        { system: 'human_design', file: 'style/style-guide-insert-human-design-voice.md', label: 'HUMAN DESIGN' },
    ];

    for (const { system, file, label } of voiceInserts) {
        if (systems.includes(system)) {
            try {
                const voice = capLayer(
                    `voice-${system}`,
                    dropSecondPersonLines(loadLayerMarkdown(file)),
                    LAYER_BUDGET.systemVoice,
                    stats
                );
                if (voice) {
                    sections.push(`SYSTEM-SPECIFIC VOICE LAYER (${label})\n${voice}`);
                }
            } catch {
                // Voice insert not found — non-fatal, system prompt alone is sufficient
            }
        }
    }

    return sections.join('\n\n');
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
    const systemPrompt = extractSystemPromptFromStyleLayer(styleLayerId, systems[0], input.readingKind);
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
    const voiceOverlayLayer = buildVoiceOverlayBlock(systems, styleLayerId, stats);

    const kabbalahPolicyLine = systems.includes('kabbalah')
        ? `KABBALAH NAME/GEMATRIA MODE: ${directive?.kabbalahNameGematriaMode || 'disabled'}`
        : '';
    const verdictLayerId = input.readingKind === 'verdict' ? resolveVerdictLayerId(directive) : undefined;
    const verdictLayer = verdictLayerId
        ? capLayer('final-verdict-layer', loadLayerMarkdown(VERDICT_LAYER_REGISTRY.files[verdictLayerId]), LAYER_BUDGET.systemKnowledge, stats)
        : '';

    const styleOverrideLayer = capLayer('style-override', soulMemoirOverride(styleLayerId), 1800, stats);

    const finalInstruction = styleLayerId === 'writing-style-guide-incarnation-v1'
        ? [
            'FINAL OUTPUT REQUIREMENT:',
            '- Return only the reading prose. One continuous literary essay punctuated by 4-6 surreal headlines (not 10, not 15 — exactly 4 to 6).',
            '- No markdown. No bullet lists.',
            '- Use this system\'s own vocabulary throughout the entire reading — as living characters, forces, rooms, weather, architecture, organisms, machinery. Never as textbook definitions or formulas.',
            '- FORBIDDEN SYNTAX: "[element] in [position] creates/indicates/suggests..." — this is a report, not a reading.',
            '- REQUIRED: Every paragraph grounded in at least one specific element from CHART DATA. The system-specific prompt defines which elements and how to deploy them.',
            '- Do not copy phrases from the Voice Anchor; invent fresh language.',
            '',
            'NARRATIVE_ARC INSTRUCTIONS (HIGHEST PRIORITY — READ BEFORE WRITING A SINGLE WORD):',
            '',
            'If the CHART DATA contains a NARRATIVE_ARC section, locate and internalize these fields before writing anything:',
            '- THE_WOUND: The entire reading serves this one thing. Not the behavior — the thing underneath it.',
            '- THE_DEFENSE: The surface pattern that opens the reading (Act 1). What draws people in.',
            '- THE_COST: Where Act 2 breaks through. What the defense destroys.',
            '- ACT_1/2/3: The emotional journey. Follow this arc.',
            '- LANDING_TEMPERATURE: The exact note the reading ends on.',
            '- WHAT_THIS_READING_MUST_NOT_DO: Read this first. Do not do this thing.',
            '',
            'If the CHART DATA does NOT contain a NARRATIVE_ARC section, derive your own arc internally BEFORE writing a word:',
            '  THE_WOUND: The single most hidden thing this chart is organized around. Not a placement — the thing a placement protects. One sentence. Specific enough that no other chart produces it.',
            '  THE_DEFENSE: What this person has always done to keep that wound invisible. The surface pattern everyone sees first.',
            '  THE_COST: What the defense destroys over time. The specific isolation or failure it produces.',
            '  ACT_1 (~first 1500 words): The defense in action. Compelling. Reader is interested, not yet unsettled.',
            '  ACT_2 (middle): The defense becomes visible AS a defense. Reader stops feeling flattered and starts feeling recognized.',
            '  ACT_3 (final section): Current timing — what this system uses for "now." What cannot continue. What is forced. No resolution. No growth language. Name the pressure and leave it present.',
            '  LANDING_TEMPERATURE: Exact emotional state at the last line. Not hopeful. Not destroyed. Specific.',
            '  WHAT_NOT_TO_DO: The flattery trap this chart invites. Name it to avoid it.',
            '',
            'Do not output this derivation. Use it as your spine. Then write the reading.',
            '',
            'THE ANTI-SURVEY TEST: If every paragraph weighs the same and could appear in any order, it is a survey. The reading must build. Something must change between the first paragraph and the last.',
        ].join('\n')
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
        voiceOverlayLayer,
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
