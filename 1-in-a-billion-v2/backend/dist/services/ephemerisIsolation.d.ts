/**
 * EPHEMERIS ISOLATION LAYER
 *
 * Spawns Swiss Ephemeris calculations in a separate child process.
 * Handles crashes, timeouts, and abnormal exits gracefully.
 * If the child crashes, this returns an error instead of killing the parent.
 */
import { ReadingPayload } from '../types';
declare class EphemerisIsolation {
    private child;
    private requestQueue;
    private nextRequestId;
    private buffer;
    /**
     * Start the ephemeris worker process
     */
    private ensureWorker;
    /**
     * Compute placements in isolated process
     */
    computePlacements(payload: ReadingPayload, timeoutMs?: number): Promise<any>;
    /**
     * Health check (uses same isolation)
     */
    healthCheck(): Promise<{
        status: 'ok' | 'error';
        message: string;
    }>;
    /**
     * Shutdown worker gracefully
     */
    shutdown(): void;
}
export declare const ephemerisIsolation: EphemerisIsolation;
export {};
//# sourceMappingURL=ephemerisIsolation.d.ts.map