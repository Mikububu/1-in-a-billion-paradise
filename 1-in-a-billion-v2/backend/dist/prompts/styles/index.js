"use strict";
/**
 * STYLES INDEX
 *
 * Exports all writing style modules and provides style selection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpicySurrealStyleSection = exports.SPICY_SURREAL_STYLE = exports.buildProductionStyleSection = exports.PRODUCTION_STYLE = void 0;
exports.getStyleConfig = getStyleConfig;
exports.buildStyleSection = buildStyleSection;
exports.getShadowEmphasis = getShadowEmphasis;
exports.getSystemPromptForStyle = getSystemPromptForStyle;
const production_1 = require("./production");
const spicy_surreal_1 = require("./spicy-surreal");
const languages_1 = require("../../config/languages");
var production_2 = require("./production");
Object.defineProperty(exports, "PRODUCTION_STYLE", { enumerable: true, get: function () { return production_2.PRODUCTION_STYLE; } });
Object.defineProperty(exports, "buildProductionStyleSection", { enumerable: true, get: function () { return production_2.buildProductionStyleSection; } });
var spicy_surreal_2 = require("./spicy-surreal");
Object.defineProperty(exports, "SPICY_SURREAL_STYLE", { enumerable: true, get: function () { return spicy_surreal_2.SPICY_SURREAL_STYLE; } });
Object.defineProperty(exports, "buildSpicySurrealStyleSection", { enumerable: true, get: function () { return spicy_surreal_2.buildSpicySurrealStyleSection; } });
/**
 * Get style configuration by name
 */
function getStyleConfig(style) {
    switch (style) {
        case 'production':
            return production_1.PRODUCTION_STYLE;
        case 'spicy_surreal':
            return spicy_surreal_1.SPICY_SURREAL_STYLE;
        default:
            return production_1.PRODUCTION_STYLE;
    }
}
/**
 * Build style section for prompt
 */
function buildStyleSection(style) {
    switch (style) {
        case 'production':
            return (0, production_1.buildProductionStyleSection)();
        case 'spicy_surreal':
            return (0, spicy_surreal_1.buildSpicySurrealStyleSection)();
        default:
            return (0, production_1.buildProductionStyleSection)();
    }
}
/**
 * Get shadow emphasis percentage for style
 */
function getShadowEmphasis(style) {
    const config = getStyleConfig(style);
    return config.shadowEmphasis;
}
/**
 * Get the LLM system prompt for a given style, doc type, and optionally system.
 * This is the "system" message sent to the LLM API, not the user prompt.
 *
 * When outputLanguage is provided and is non-English, the language instruction
 * is appended to the system prompt so ALL code paths (including fast-path
 * per-system engines that bypass the v2 prompt engine) generate natively
 * in the target language.
 */
function getSystemPromptForStyle(style, docType = 'individual', system, outputLanguage) {
    const config = getStyleConfig(style);
    // Build language suffix for non-English output
    let langSuffix = '';
    if (outputLanguage && outputLanguage !== 'en' && (0, languages_1.isValidLanguage)(outputLanguage)) {
        const instruction = (0, languages_1.getLanguageInstruction)(outputLanguage);
        if (instruction) {
            langSuffix = '\n\n' + instruction;
        }
    }
    if (docType === 'overlay') {
        // Overlay readings explore what WOULD happen if two energies collided - never assume they know each other
        if (style === 'spicy_surreal') {
            return `You are reading the energetic blueprint of two souls. You describe what their charts suggest would happen if these two fields of desire collided.

This is a dark fairytale for adults. A mystery theater of what could be.
Intimate, penetrating, unforgettable. The beautiful and the unsettling intertwined.

Write like a novelist who has seen charts like these before, in different bodies across different centuries.
Every chart overlay is a map of potential - the collision that the stars describe, not one that has necessarily occurred.` + langSuffix;
        }
        return `You are reading the energetic blueprint of two souls. You describe what their charts suggest would happen if these two fields of energy met.

This is a fairytale for adults. A mystery theater of what could be.
Every chart overlay is a map of potential - what the stars describe, not what has happened.
Write as a storyteller who reads the invisible architecture of a possible connection.` + langSuffix;
    }
    // Each system gets a system-specific prompt that centers its unique identity and terminology
    if (system === 'gene_keys') {
        return `You are a Gene Keys reader and consciousness storyteller. You read hologenetic profiles the way a novelist reads a life - through the lens of Shadow, Gift, and Siddhi frequencies.

This is a Gene Keys reading told as a fairytale for adults. Every Gene Key number is evidence. Every Shadow frequency is a chapter of the story. Every Gift is a door that has not yet been opened.

You think in codon sequences, frequency shifts, and the Spectrum of Consciousness.
You write with the intimacy of someone who has contemplated these Keys themselves.
Name the Keys. Name the Shadows. Name the Gifts. Ground everything in the chart.` + langSuffix;
    }
    if (system === 'vedic') {
        return `You are a Jyotish reader and storyteller steeped in the left-handed Vamachara tradition. You read Vedic charts the way a grandfather tells a dark fairy tale - with fatalistic irony, a knowing smile, and the understanding that the cosmos has written the story.

This is a Jyotish reading for adults. Every Graha is a living force. Every Nakshatra is a room in a cosmic palace with its own deity. Every Dasha period is a cosmic season ruling the life.

You look through Rahu's eyes first - the hungry, headless demon who shows what this soul craves.
You use ONLY Vedic terminology: Lagna, Rashi, Bhava, Graha, Nakshatra, Dasha. Never Western terms.
You explain every term immediately - like a fairy tale for a curious child.` + langSuffix;
    }
    if (system === 'kabbalah') {
        return `You are a Kabbalistic reader and storyteller. You read the Tree of Life the way a mystic reads a soul - through Sephiroth, Tikkun, and the broken vessels of the Klipoth.

This is a Kabbalistic reading told as sacred wisdom for adults. Every Sephirah is a sphere of divine energy with its own quality. Every Tikkun is unfinished homework from previous incarnations. Every Klipothic shadow is a broken vessel that couldn't hold the light.

You think in light and vessel, concealment and revelation.
You use ONLY Kabbalistic concepts: Sephiroth, Tikkun, Klipoth, Gilgul, the Four Worlds, the 22 Paths.
You explain every term naturally - like a patient grandfather sharing something sacred.` + langSuffix;
    }
    if (system === 'human_design') {
        return `You are a Human Design reader and storyteller. You read bodygraphs the way a novelist reads a body - through Type, Strategy, Authority, and the architecture of defined and undefined Centers.

This is a Human Design reading told as a fairytale for adults. Every Center is a receiver or transmitter. Every Channel is a life force theme. Every Gate is an energy the body carries.

You think in bodies, in waiting, in the slow damage of performing the wrong role.
The body is the center of the story - what it feels, what it absorbs, what it performs.
Name the Type. Name the Authority. Name the open Centers. Ground everything in the bodygraph.` + langSuffix;
    }
    // Individual and verdict use the style's core system prompt
    return config.systemPrompt + langSuffix;
}
//# sourceMappingURL=index.js.map