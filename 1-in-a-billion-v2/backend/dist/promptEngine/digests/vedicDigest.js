"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVedicChartDigestPrompt = buildVedicChartDigestPrompt;
exports.validateVedicDigest = validateVedicDigest;
exports.validateVedicDigestAgainstChartData = validateVedicDigestAgainstChartData;
const layerLoader_1 = require("../layerLoader");
const DIGEST_HEADER = 'VEDIC_CHART_DIGEST_V1';
function buildVedicChartDigestPrompt(params) {
    const { personName, chartData } = params;
    const digestTemplate = (0, layerLoader_1.loadLayerMarkdown)('digests/vedic-chart-digest-v1.md');
    return [
        DIGEST_HEADER,
        '',
        `You are creating a compact "Vedic Chart Digest" for ${personName}.`,
        'Purpose: this digest will be fed into a second-pass long-form writing prompt.',
        'This is not the final reading. It is a compressed evidence-and-structure document.',
        '',
        digestTemplate,
        '',
        'CHART DATA (authoritative):',
        chartData,
        '',
        'NOW PRODUCE THE DIGEST.',
    ].join('\n');
}
function validateVedicDigest(params) {
    const { digest, chartData } = params;
    const text = String(digest || '').trim();
    if (!text.startsWith(DIGEST_HEADER)) {
        return { ok: false, reason: `Missing digest header "${DIGEST_HEADER}"` };
    }
    const requiredSections = [
        'LAGNA SIGNATURE',
        'CHANDRA SIGNATURE',
        'GRAHA MAP',
        'LOUDEST SIGNAL',
        'KARMIC ENGINE',
        'TEMPERATURE',
        'MOTIFS',
        'NARRATIVE_ARC',
        'THE_WOUND',
        'LANDING_TEMPERATURE',
    ];
    const missingSections = requiredSections.filter((s) => !text.includes(s));
    if (missingSections.length > 0) {
        return { ok: false, reason: `Missing sections: ${missingSections.join(', ')}` };
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 400) {
        return { ok: false, reason: `Digest too short (${wordCount} words, need 400+)` };
    }
    const lagnaMatch = chartData.match(/Lagna \(Ascendant\):\s*(\w+)/i);
    if (lagnaMatch && lagnaMatch[1]) {
        const lagnaSign = lagnaMatch[1];
        if (!text.includes(lagnaSign)) {
            return { ok: false, reason: `Lagna sign "${lagnaSign}" from chart data not found in digest` };
        }
    }
    return { ok: true };
}
function validateVedicDigestAgainstChartData(params) {
    return validateVedicDigest({
        digest: params.digest,
        chartData: params.chartData || '',
    });
}
//# sourceMappingURL=vedicDigest.js.map