/**
 * Fetch prompt layer from Supabase `ai_configurations` table.
 */
export declare function loadLayerMarkdownAsync(relativeFile: string): Promise<string>;
/**
 * Fetch a generic configuration scalar from Supabase `ai_configurations` table.
 */
export declare function getConfigAsync(key: string, defaultValue?: string): Promise<string>;
/**
 * Synchronous local fallback.
 * DEPRECATED: Do not use for production. Will block or throw if prompt is only in DB.
 */
export declare function loadLayerMarkdown(relativeFile: string): string;
//# sourceMappingURL=layerLoader.d.ts.map