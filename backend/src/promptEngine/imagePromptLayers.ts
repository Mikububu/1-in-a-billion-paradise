import { loadLayerMarkdown } from './layerLoader';

export type ImagePromptKind = 'single_portrait' | 'synastry_portrait';

const IMAGE_PROMPT_LAYER_FILE = 'images/image-transformation-prompts.md';

const IMAGE_PROMPT_MARKERS: Record<ImagePromptKind, { start: string; end: string }> = {
    single_portrait: {
        start: '<!-- PROMPT:single_portrait:start -->',
        end: '<!-- PROMPT:single_portrait:end -->',
    },
    synastry_portrait: {
        start: '<!-- PROMPT:synastry_portrait:start -->',
        end: '<!-- PROMPT:synastry_portrait:end -->',
    },
};

function extractPromptBlock(markdown: string, kind: ImagePromptKind): string {
    const markers = IMAGE_PROMPT_MARKERS[kind];
    const startIndex = markdown.indexOf(markers.start);
    const endIndex = markdown.indexOf(markers.end);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        throw new Error(
            `Image prompt block "${kind}" not found in ${IMAGE_PROMPT_LAYER_FILE}. ` +
            `Expected markers: ${markers.start} ... ${markers.end}`
        );
    }

    const block = markdown
        .slice(startIndex + markers.start.length, endIndex)
        .trim();

    if (!block) {
        throw new Error(`Image prompt block "${kind}" is empty in ${IMAGE_PROMPT_LAYER_FILE}`);
    }

    return block;
}

export function loadImagePromptLayer(kind: ImagePromptKind): string {
    const markdown = loadLayerMarkdown(IMAGE_PROMPT_LAYER_FILE);
    return extractPromptBlock(markdown, kind);
}

export function loadAllImagePromptLayers(): Record<ImagePromptKind, string> {
    const markdown = loadLayerMarkdown(IMAGE_PROMPT_LAYER_FILE);
    return {
        single_portrait: extractPromptBlock(markdown, 'single_portrait'),
        synastry_portrait: extractPromptBlock(markdown, 'synastry_portrait'),
    };
}
