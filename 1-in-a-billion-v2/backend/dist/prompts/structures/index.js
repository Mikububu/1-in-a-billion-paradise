"use strict";
/**
 * STRUCTURES INDEX
 *
 * Exports all reading structure modules.
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
exports.READING_CONFIGS = void 0;
__exportStar(require("./individual"), exports);
__exportStar(require("./overlay"), exports);
__exportStar(require("./nuclear"), exports);
exports.READING_CONFIGS = {
    individual: {
        totalWords: 8000,
        audioMinutes: 60,
        apiCalls: 1,
    },
    overlay: {
        totalWords: 12000,
        audioMinutes: 90,
        apiCalls: 2,
    },
    nuclear: {
        totalWords: 30000,
        audioMinutes: 150,
        apiCalls: 5,
    },
};
//# sourceMappingURL=index.js.map