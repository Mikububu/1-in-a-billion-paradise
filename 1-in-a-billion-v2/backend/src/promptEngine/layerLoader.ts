import fs from 'node:fs';
import path from 'node:path';
import { createSupabaseServiceClient } from '../services/supabaseClient';

const CANDIDATE_LAYER_ROOTS = [
    path.resolve(process.cwd(), 'backend/prompt-layers'),
    path.resolve(process.cwd(), 'prompt-layers'),
    path.resolve(__dirname, '../../prompt-layers'),
    path.resolve(__dirname, '../../../prompt-layers'),
];

function resolveLayerRoot(): string {
    const found = CANDIDATE_LAYER_ROOTS.find((candidate) => fs.existsSync(candidate));
    if (!found) {
        throw new Error(
            `Could not resolve prompt layer root. Checked: ${CANDIDATE_LAYER_ROOTS.join(', ')}`
        );
    }
    return found;
}

// Memory cache for fetched layers to prevent redundant DB calls
const layerCache = new Map<string, string>();
const LAYER_CACHE_MAX_SIZE = 100;

function addToLayerCache(key: string, value: string) {
    if (layerCache.size >= LAYER_CACHE_MAX_SIZE) {
        const firstKey = layerCache.keys().next().value;
        if (firstKey !== undefined) layerCache.delete(firstKey);
    }
    layerCache.set(key, value);
}

/**
 * Validates a layer name, ensuring we fetch by the pure key (e.g. 'gene-keys-individual')
 * instead of 'systems/gene-keys-individual.md'.
 */
function extractKeyFromPath(relativeFile: string): string {
    const parsed = path.parse(relativeFile);
    return parsed.name; // returns just the filename without extension or directory
}

/**
 * Fetch prompt layer from Supabase `ai_configurations` table.
 */
export async function loadLayerMarkdownAsync(relativeFile: string): Promise<string> {
    const key = extractKeyFromPath(relativeFile);

    // 1. Check Cache
    if (layerCache.has(key)) {
        return layerCache.get(key)!;
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized context for loadLayerMarkdownAsync');
    }

    // 2. Fetch from DB
    const { data, error } = await supabase
        .from('ai_configurations')
        .select('content')
        .eq('key', key)
        .maybeSingle();

    if (error) {
        throw new Error(`DB Error fetching prompt layer ${key}: ${error.message}`);
    }

    if (data?.content) {
        const content = data.content.trim();
        addToLayerCache(key, content);
        return content;
    }

    // 3. Fallback to local filesystem if not found in database (useful during dev/transition)
    return loadLayerMarkdown(relativeFile);
}

/**
 * Fetch a generic configuration scalar from Supabase `ai_configurations` table.
 */
export async function getConfigAsync(key: string, defaultValue: string = ''): Promise<string> {
    if (layerCache.has(key)) {
        return layerCache.get(key)!;
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return defaultValue;
    }

    const { data, error } = await supabase
        .from('ai_configurations')
        .select('content')
        .eq('key', key)
        .maybeSingle();

    if (!error && data?.content) {
        const content = data.content.trim();
        addToLayerCache(key, content);
        return content;
    }

    return defaultValue;
}

/**
 * Synchronous local fallback.
 * DEPRECATED: Do not use for production. Will block or throw if prompt is only in DB.
 */
export function loadLayerMarkdown(relativeFile: string): string {
    const layerRoot = resolveLayerRoot();
    const absolute = path.resolve(layerRoot, relativeFile);

    if (!absolute.startsWith(layerRoot)) {
        throw new Error(`Invalid layer path traversal attempt: ${relativeFile}`);
    }

    if (!fs.existsSync(absolute)) {
        throw new Error(`Prompt layer file not found locally: ${absolute}`);
    }

    return fs.readFileSync(absolute, 'utf8').trim();
}
