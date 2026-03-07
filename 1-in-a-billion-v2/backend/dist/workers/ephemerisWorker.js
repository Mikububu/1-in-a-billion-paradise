#!/usr/bin/env node
"use strict";
/**
 * EPHEMERIS WORKER - Isolated Child Process
 *
 * Runs Swiss Ephemeris calculations in a separate process.
 * If the native module crashes, only this process dies - not the parent worker.
 *
 * Communication protocol (stdin/stdout):
 * - Parent sends JSON: { id: string, payload: ReadingPayload }
 * - Child responds JSON: { id: string, success: boolean, result?: PlacementSummary, error?: string }
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CRITICAL: This worker uses stdout as a JSONL transport channel.
 * Any console.log/console.info output from imported modules (e.g. swissEphemeris)
 * would corrupt the protocol and break the parent parser.
 *
 * Route non-error logging to stderr to keep stdout clean.
 */
const writeStderr = (...args) => {
    try {
        const msg = args
            .map((a) => {
            if (typeof a === 'string')
                return a;
            try {
                return JSON.stringify(a);
            }
            catch {
                return String(a);
            }
        })
            .join(' ');
        process.stderr.write(msg + '\n');
    }
    catch {
        // ignore
    }
};
// Redirect standard logs to stderr (stdout reserved for JSON responses)
// eslint-disable-next-line no-console
console.log = writeStderr;
// eslint-disable-next-line no-console
console.info = writeStderr;
// eslint-disable-next-line no-console
console.warn = writeStderr;
let swissEnginePromise = null;
async function getSwissEngine() {
    if (!swissEnginePromise) {
        // Dynamic import so swissEphemeris module init logs respect our stderr redirection.
        swissEnginePromise = Promise.resolve().then(() => __importStar(require('../services/swissEphemeris')));
    }
    const mod = await swissEnginePromise;
    return mod.swissEngine;
}
// Process one request
async function handleRequest(req) {
    try {
        const swissEngine = await getSwissEngine();
        const result = await swissEngine.computePlacements(req.payload);
        return {
            id: req.id,
            success: true,
            result,
        };
    }
    catch (error) {
        return {
            id: req.id,
            success: false,
            error: error.message || String(error),
        };
    }
}
// Read from stdin, write to stdout
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    for (const line of lines) {
        if (!line.trim())
            continue;
        try {
            const request = JSON.parse(line);
            const response = await handleRequest(request);
            process.stdout.write(JSON.stringify(response) + '\n');
        }
        catch (error) {
            // Invalid JSON or parsing error
            process.stderr.write(`Invalid request: ${error.message}\n`);
        }
    }
});
process.stdin.on('end', () => {
    process.exit(0);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    process.exit(0);
});
process.on('SIGINT', () => {
    process.exit(0);
});
console.error('[Ephemeris Worker] Started and waiting for requests');
//# sourceMappingURL=ephemerisWorker.js.map