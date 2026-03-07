export type ImagePromptKind = 'single_portrait' | 'synastry_portrait';
export declare function loadImagePromptLayerAsync(kind: ImagePromptKind): Promise<string>;
export declare function loadAllImagePromptLayersAsync(): Promise<Record<ImagePromptKind, string>>;
//# sourceMappingURL=imagePromptLayers.d.ts.map