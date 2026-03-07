"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const composePrompt_1 = require("./composePrompt");
const result = (0, composePrompt_1.composePrompt)({
    readingKind: 'individual',
    systems: ['kabbalah'],
    person1Name: 'Michael',
    chartData: 'Sample chart data goes here',
    personalContext: 'Currently navigating relationship transitions.',
    outputLanguage: 'english',
    promptLayerDirective: {
        sharedWritingStyleLayerId: 'writing-style-guide-v1',
        kabbalahNameGematriaMode: 'disabled',
        systems: {
            kabbalah: {
                individualLayerId: 'kabbalah-individual-v2',
                synastryLayerId: 'kabbalah-synastry-v2',
                analysisVersion: 'v2',
            },
        },
    },
});
console.log(JSON.stringify(result.diagnostics, null, 2));
console.log(result.prompt.slice(0, 800));
//# sourceMappingURL=exampleCompose.js.map