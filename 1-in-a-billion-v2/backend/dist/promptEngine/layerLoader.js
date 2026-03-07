"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLayerMarkdownAsync = loadLayerMarkdownAsync;
exports.getConfigAsync = getConfigAsync;
exports.loadLayerMarkdown = loadLayerMarkdown;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const supabaseClient_1 = require("../services/supabaseClient");
const CANDIDATE_LAYER_ROOTS = [
    node_path_1.default.resolve(process.cwd(), 'backend/prompt-layers'),
    node_path_1.default.resolve(process.cwd(), 'prompt-layers'),
    node_path_1.default.resolve(__dirname, '../../prompt-layers'),
    node_path_1.default.resolve(__dirname, '../../../prompt-layers'),
];
function resolveLayerRoot() {
    const found = CANDIDATE_LAYER_ROOTS.find((candidate) => node_fs_1.default.existsSync(candidate));
    if (!found) {
        throw new Error(`Could not resolve prompt layer root. Checked: ${CANDIDATE_LAYER_ROOTS.join(', ')}`);
    }
    return found;
}
// Memory cache for fetched layers to prevent redundant DB calls
const layerCache = new Map();
const LAYER_CACHE_MAX_SIZE = 100;
function addToLayerCache(key, value) {
    if (layerCache.size >= LAYER_CACHE_MAX_SIZE) {
        const firstKey = layerCache.keys().next().value;
        if (firstKey !== undefined)
            layerCache.delete(firstKey);
    }
    layerCache.set(key, value);
}
/**
 * Validates a layer name, ensuring we fetch by the pure key (e.g. 'gene-keys-individual')
 * instead of 'systems/gene-keys-individual.md'.
 */
function extractKeyFromPath(relativeFile) {
    const parsed = node_path_1.default.parse(relativeFile);
    return parsed.name; // returns just the filename without extension or directory
}
/**
 * Fetch prompt layer from Supabase `ai_configurations` table.
 */
async function loadLayerMarkdownAsync(relativeFile) {
    const key = extractKeyFromPath(relativeFile);
    // 1. Check Cache
    if (layerCache.has(key)) {
        return layerCache.get(key);
    }
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
async function getConfigAsync(key, defaultValue = '') {
    if (layerCache.has(key)) {
        return layerCache.get(key);
    }
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
function loadLayerMarkdown(relativeFile) {
    const layerRoot = resolveLayerRoot();
    const absolute = node_path_1.default.resolve(layerRoot, relativeFile);
    if (!absolute.startsWith(layerRoot)) {
        throw new Error(`Invalid layer path traversal attempt: ${relativeFile}`);
    }
    if (!node_fs_1.default.existsSync(absolute)) {
        throw new Error(`Prompt layer file not found locally: ${absolute}`);
    }
    return node_fs_1.default.readFileSync(absolute, 'utf8').trim();
}
//# sourceMappingURL=layerLoader.js.map