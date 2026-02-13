import { composePrompt } from './composePrompt';

const result = composePrompt({
    readingKind: 'individual',
    systems: ['kabbalah'],
    person1Name: 'Michael',
    chartData: 'Sample chart data goes here',
    personalContext: 'Currently navigating relationship transitions.',
    outputLanguage: 'english',
    promptLayerDirective: {
        sharedWritingStyleLayerId: 'shared-astro-fairytale-style-v1',
        kabbalahNameGematriaMode: 'disabled',
        systems: {
            kabbalah: {
                analysisLayerId: 'kabbalah-analysis-v2-no-name-gematria',
                analysisVersion: 'v2',
            },
        },
    },
});

console.log(JSON.stringify(result.diagnostics, null, 2));
console.log(result.prompt.slice(0, 800));
