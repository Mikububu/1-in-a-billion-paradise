"use strict";
/**
 * MODULAR PROMPT SYSTEM
 *
 * Main entry point for the prompt generation system.
 *
 * This system is:
 * - LLM-agnostic (works with Claude, GPT, Gemini, etc.)
 * - Modular (change style in one place, affects everything)
 * - Maintainable (each concern in its own file)
 *
 * Source: Michael's gold prompt documents
 * Architecture: docs/PROMPT_SYSTEM_ARCHITECTURE.md
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemWeavingSection = exports.buildTransformationsSection = exports.TRANSFORMATIONS = exports.getNuclearPart = exports.NUCLEAR_PARTS = exports.READING_CONFIGS = exports.buildAllSystemsSection = exports.buildSystemSection = exports.SYSTEM_DISPLAY_NAMES = exports.ALL_SYSTEMS = exports.getShadowPercent = exports.getSpiceConfig = exports.buildSpiceSection = exports.getStyleConfig = exports.buildStyleSection = exports.buildOverlayPrompt = exports.buildSimpleIndividualPrompt = exports.buildIndividualPrompt = exports.buildPrompt = void 0;
// Main builder functions
var builder_1 = require("./builder");
Object.defineProperty(exports, "buildPrompt", { enumerable: true, get: function () { return builder_1.buildPrompt; } });
Object.defineProperty(exports, "buildIndividualPrompt", { enumerable: true, get: function () { return builder_1.buildIndividualPrompt; } });
Object.defineProperty(exports, "buildSimpleIndividualPrompt", { enumerable: true, get: function () { return builder_1.buildSimpleIndividualPrompt; } });
Object.defineProperty(exports, "buildOverlayPrompt", { enumerable: true, get: function () { return builder_1.buildOverlayPrompt; } });
// Core modules
__exportStar(require("./core"), exports);
// Styles
var styles_1 = require("./styles");
Object.defineProperty(exports, "buildStyleSection", { enumerable: true, get: function () { return styles_1.buildStyleSection; } });
Object.defineProperty(exports, "getStyleConfig", { enumerable: true, get: function () { return styles_1.getStyleConfig; } });
// Spice levels
var spice_1 = require("./spice");
Object.defineProperty(exports, "buildSpiceSection", { enumerable: true, get: function () { return spice_1.buildSpiceSection; } });
Object.defineProperty(exports, "getSpiceConfig", { enumerable: true, get: function () { return spice_1.getSpiceConfig; } });
Object.defineProperty(exports, "getShadowPercent", { enumerable: true, get: function () { return spice_1.getShadowPercent; } });
// Systems
var systems_1 = require("./systems");
Object.defineProperty(exports, "ALL_SYSTEMS", { enumerable: true, get: function () { return systems_1.ALL_SYSTEMS; } });
Object.defineProperty(exports, "SYSTEM_DISPLAY_NAMES", { enumerable: true, get: function () { return systems_1.SYSTEM_DISPLAY_NAMES; } });
Object.defineProperty(exports, "buildSystemSection", { enumerable: true, get: function () { return systems_1.buildSystemSection; } });
Object.defineProperty(exports, "buildAllSystemsSection", { enumerable: true, get: function () { return systems_1.buildAllSystemsSection; } });
// Structures
var structures_1 = require("./structures");
Object.defineProperty(exports, "READING_CONFIGS", { enumerable: true, get: function () { return structures_1.READING_CONFIGS; } });
Object.defineProperty(exports, "NUCLEAR_PARTS", { enumerable: true, get: function () { return structures_1.NUCLEAR_PARTS; } });
Object.defineProperty(exports, "getNuclearPart", { enumerable: true, get: function () { return structures_1.getNuclearPart; } });
// Examples
var examples_1 = require("./examples");
Object.defineProperty(exports, "TRANSFORMATIONS", { enumerable: true, get: function () { return examples_1.TRANSFORMATIONS; } });
Object.defineProperty(exports, "buildTransformationsSection", { enumerable: true, get: function () { return examples_1.buildTransformationsSection; } });
// Techniques
var techniques_1 = require("./techniques");
Object.defineProperty(exports, "buildSystemWeavingSection", { enumerable: true, get: function () { return techniques_1.buildSystemWeavingSection; } });
//# sourceMappingURL=index.js.map