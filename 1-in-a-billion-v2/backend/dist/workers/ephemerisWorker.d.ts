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
export {};
//# sourceMappingURL=ephemerisWorker.d.ts.map