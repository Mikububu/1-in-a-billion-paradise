"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadImagePromptLayerAsync = loadImagePromptLayerAsync;
exports.loadAllImagePromptLayersAsync = loadAllImagePromptLayersAsync;
const layerLoader_1 = require("./layerLoader");
const IMAGE_PROMPT_LAYER_FILE = 'images/image-transformation-prompts.md';
const IMAGE_PROMPT_MARKERS = {
    single_portrait: {
        start: '<!-- PROMPT:single_portrait:start -->',
        end: '<!-- PROMPT:single_portrait:end -->',
    },
    synastry_portrait: {
        start: '<!-- PROMPT:synastry_portrait:start -->',
        end: '<!-- PROMPT:synastry_portrait:end -->',
    },
};
function extractPromptBlock(markdown, kind) {
    const markers = IMAGE_PROMPT_MARKERS[kind];
    const startIndex = markdown.indexOf(markers.start);
    const endIndex = markdown.indexOf(markers.end);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        throw new Error(`Image prompt block "${kind}" not found in ${IMAGE_PROMPT_LAYER_FILE}. ` +
            `Expected markers: ${markers.start} ... ${markers.end}`);
    }
    const block = markdown
        .slice(startIndex + markers.start.length, endIndex)
        .trim();
    if (!block) {
        throw new Error(`Image prompt block "${kind}" is empty in ${IMAGE_PROMPT_LAYER_FILE}`);
    }
    return block;
}
async function loadImagePromptLayerAsync(kind) {
    const markdown = await (0, layerLoader_1.loadLayerMarkdownAsync)(IMAGE_PROMPT_LAYER_FILE);
    return extractPromptBlock(markdown, kind);
}
async function loadAllImagePromptLayersAsync() {
    const markdown = await (0, layerLoader_1.loadLayerMarkdownAsync)(IMAGE_PROMPT_LAYER_FILE);
    return {
        single_portrait: extractPromptBlock(markdown, 'single_portrait'),
        synastry_portrait: extractPromptBlock(markdown, 'synastry_portrait'),
    };
}
//# sourceMappingURL=imagePromptLayers.js.map