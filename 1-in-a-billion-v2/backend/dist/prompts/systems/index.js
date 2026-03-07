"use strict";
/**
 * SYSTEMS INDEX
 *
 * Exports all astrological system modules and provides system selection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_DISPLAY_NAMES = exports.ALL_SYSTEMS = exports.buildKabbalahSection = exports.KABBALAH_SYSTEM = exports.buildHumanDesignSection = exports.HUMAN_DESIGN_SYSTEM = exports.buildGeneKeysSection = exports.GENE_KEYS_SYSTEM = exports.buildVedicSection = exports.VEDIC_SYSTEM = exports.buildWesternSection = exports.WESTERN_SYSTEM = void 0;
exports.getSystemConfig = getSystemConfig;
exports.buildSystemSection = buildSystemSection;
exports.buildAllSystemsSection = buildAllSystemsSection;
const western_1 = require("./western");
const vedic_1 = require("./vedic");
const gene_keys_1 = require("./gene-keys");
const human_design_1 = require("./human-design");
const kabbalah_1 = require("./kabbalah");
var western_2 = require("./western");
Object.defineProperty(exports, "WESTERN_SYSTEM", { enumerable: true, get: function () { return western_2.WESTERN_SYSTEM; } });
Object.defineProperty(exports, "buildWesternSection", { enumerable: true, get: function () { return western_2.buildWesternSection; } });
var vedic_2 = require("./vedic");
Object.defineProperty(exports, "VEDIC_SYSTEM", { enumerable: true, get: function () { return vedic_2.VEDIC_SYSTEM; } });
Object.defineProperty(exports, "buildVedicSection", { enumerable: true, get: function () { return vedic_2.buildVedicSection; } });
var gene_keys_2 = require("./gene-keys");
Object.defineProperty(exports, "GENE_KEYS_SYSTEM", { enumerable: true, get: function () { return gene_keys_2.GENE_KEYS_SYSTEM; } });
Object.defineProperty(exports, "buildGeneKeysSection", { enumerable: true, get: function () { return gene_keys_2.buildGeneKeysSection; } });
var human_design_2 = require("./human-design");
Object.defineProperty(exports, "HUMAN_DESIGN_SYSTEM", { enumerable: true, get: function () { return human_design_2.HUMAN_DESIGN_SYSTEM; } });
Object.defineProperty(exports, "buildHumanDesignSection", { enumerable: true, get: function () { return human_design_2.buildHumanDesignSection; } });
var kabbalah_2 = require("./kabbalah");
Object.defineProperty(exports, "KABBALAH_SYSTEM", { enumerable: true, get: function () { return kabbalah_2.KABBALAH_SYSTEM; } });
Object.defineProperty(exports, "buildKabbalahSection", { enumerable: true, get: function () { return kabbalah_2.buildKabbalahSection; } });
exports.ALL_SYSTEMS = ['western', 'vedic', 'gene_keys', 'human_design', 'kabbalah'];
exports.SYSTEM_DISPLAY_NAMES = {
    western: 'Western Astrology',
    vedic: 'Vedic Astrology (Jyotish)',
    gene_keys: 'Gene Keys',
    human_design: 'Human Design',
    kabbalah: 'Kabbalistic Astrology',
};
/**
 * Get system configuration by name
 */
function getSystemConfig(system) {
    switch (system) {
        case 'western':
            return western_1.WESTERN_SYSTEM;
        case 'vedic':
            return vedic_1.VEDIC_SYSTEM;
        case 'gene_keys':
            return gene_keys_1.GENE_KEYS_SYSTEM;
        case 'human_design':
            return human_design_1.HUMAN_DESIGN_SYSTEM;
        case 'kabbalah':
            return kabbalah_1.KABBALAH_SYSTEM;
    }
}
/**
 * Build system guidance section for a single system
 */
function buildSystemSection(system, isRelationship, spiceLevel = 5) {
    switch (system) {
        case 'western':
            return (0, western_1.buildWesternSection)(isRelationship);
        case 'vedic':
            return (0, vedic_1.buildVedicSection)(isRelationship, spiceLevel);
        case 'gene_keys':
            return (0, gene_keys_1.buildGeneKeysSection)(isRelationship);
        case 'human_design':
            return (0, human_design_1.buildHumanDesignSection)(isRelationship);
        case 'kabbalah':
            return (0, kabbalah_1.buildKabbalahSection)(isRelationship);
    }
}
/**
 * Build combined system guidance for all 5 systems (Nuclear)
 */
function buildAllSystemsSection(isRelationship, spiceLevel) {
    let section = `
═══════════════════════════════════════════════════════════════════════════════
ALL 5 SYSTEMS - SYNTHESIS REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You must analyze through ALL 5 systems and WEAVE them together.
Do NOT list systems separately. SYNTHESIZE them into one narrative.

`;
    for (const system of exports.ALL_SYSTEMS) {
        section += buildSystemSection(system, isRelationship, spiceLevel);
        section += '\n';
    }
    return section;
}
//# sourceMappingURL=index.js.map