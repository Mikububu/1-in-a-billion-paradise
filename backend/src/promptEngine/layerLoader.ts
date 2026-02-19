import fs from 'node:fs';
import path from 'node:path';

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

export function loadLayerMarkdown(relativeFile: string): string {
    const layerRoot = resolveLayerRoot();
    const absolute = path.resolve(layerRoot, relativeFile);

    if (!absolute.startsWith(layerRoot)) {
        throw new Error(`Invalid layer path traversal attempt: ${relativeFile}`);
    }

    if (!fs.existsSync(absolute)) {
        throw new Error(`Prompt layer file not found: ${absolute}`);
    }

    return fs.readFileSync(absolute, 'utf8').trim();
}
