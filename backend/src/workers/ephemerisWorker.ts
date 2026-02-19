#!/usr/bin/env node
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

import type { ReadingPayload } from '../types';

interface Request {
    id: string;
    payload: ReadingPayload;
}

interface Response {
    id: string;
    success: boolean;
    result?: any;
    error?: string;
}

/**
 * CRITICAL: This worker uses stdout as a JSONL transport channel.
 * Any console.log/console.info output from imported modules (e.g. swissEphemeris)
 * would corrupt the protocol and break the parent parser.
 *
 * Route non-error logging to stderr to keep stdout clean.
 */
const writeStderr = (...args: any[]) => {
    try {
        const msg = args
            .map((a) => {
                if (typeof a === 'string') return a;
                try { return JSON.stringify(a); } catch { return String(a); }
            })
            .join(' ');
        process.stderr.write(msg + '\n');
    } catch {
        // ignore
    }
};

// Redirect standard logs to stderr (stdout reserved for JSON responses)
// eslint-disable-next-line no-console
console.log = writeStderr as any;
// eslint-disable-next-line no-console
console.info = writeStderr as any;
// eslint-disable-next-line no-console
console.warn = writeStderr as any;

let swissEnginePromise: Promise<{ swissEngine: { computePlacements: (payload: ReadingPayload) => Promise<any> } }> | null = null;
async function getSwissEngine() {
    if (!swissEnginePromise) {
        // Dynamic import so swissEphemeris module init logs respect our stderr redirection.
        swissEnginePromise = import('../services/swissEphemeris') as any;
    }
    const mod: any = await swissEnginePromise!;
    return mod.swissEngine;
}

// Process one request
async function handleRequest(req: Request): Promise<Response> {
    try {
        const swissEngine = await getSwissEngine();
        const result = await swissEngine.computePlacements(req.payload);
        return {
            id: req.id,
            success: true,
            result,
        };
    } catch (error: any) {
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

process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
        if (!line.trim()) continue;

        try {
            const request: Request = JSON.parse(line);
            const response = await handleRequest(request);
            process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error: any) {
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
