import { composePrompt } from './composePrompt';
import { ComposePromptInput, SystemId } from './types';

const isSystem = (value: string): value is SystemId =>
    value === 'western' ||
    value === 'vedic' ||
    value === 'human_design' ||
    value === 'gene_keys' ||
    value === 'kabbalah';

export function composePromptFromJobStartPayload(payload: any): ReturnType<typeof composePrompt> {
    const systems = Array.isArray(payload?.systems) ? payload.systems.filter(isSystem) : [];
    const readingKind = payload?.type === 'synastry'
        ? 'synastry'
        : payload?.type === 'bundle_verdict'
            ? 'verdict'
            : 'individual';
    const rawPreference = Number(payload?.relationshipPreferenceScale);
    const relationshipPreferenceScale = Number.isFinite(rawPreference)
        ? Math.min(10, Math.max(1, Math.round(rawPreference)))
        : undefined;

    const input: ComposePromptInput = {
        readingKind,
        systems,
        person1Name: payload?.person1?.name || 'Person 1',
        person2Name: payload?.person2?.name,
        chartData: typeof payload?.chartData === 'string' ? payload.chartData : '[Chart data injected by worker]',
        relationshipPreferenceScale,
        personalContext: typeof payload?.personalContext === 'string' ? payload.personalContext : undefined,
        relationshipContext: typeof payload?.relationshipContext === 'string' ? payload.relationshipContext : undefined,
        outputLanguage: typeof payload?.outputLanguage === 'string' ? payload.outputLanguage : undefined,
        promptLayerDirective: payload?.promptLayerDirective,
    };

    return composePrompt(input);
}
