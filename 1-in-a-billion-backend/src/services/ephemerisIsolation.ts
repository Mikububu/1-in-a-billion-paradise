/**
 * EPHEMERIS ISOLATION LAYER
 * 
 * Spawns Swiss Ephemeris calculations in a separate child process.
 * Handles crashes, timeouts, and abnormal exits gracefully.
 * If the child crashes, this returns an error instead of killing the parent.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ReadingPayload } from '../types';

interface EphemerisRequest {
    id: string;
    payload: ReadingPayload;
}

interface EphemerisResponse {
    id: string;
    success: boolean;
    result?: any;
    error?: string;
}

class EphemerisIsolation {
    private child: ChildProcess | null = null;
    private requestQueue: Map<string, {
        resolve: (result: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private nextRequestId = 1;
    private buffer = '';

    /**
     * Start the ephemeris worker process
     */
    private ensureWorker(): void {
        if (this.child && !this.child.killed) {
            return; // Already running
        }

        // Try multiple paths for the worker (dist vs src, different build configs)
        const possiblePaths = [
            path.resolve(__dirname, '../workers/ephemerisWorker.js'), // From dist/services
            path.resolve(__dirname, '../../dist/workers/ephemerisWorker.js'), // From src/services via ts-node
            path.resolve(__dirname, './ephemerisWorker.js'), // Same dir (flat build)
        ];

        let workerPath = possiblePaths[0];
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                workerPath = testPath;
                break;
            }
        }

        console.log(`[Ephemeris Isolation] Worker path: ${workerPath}`);

        this.child = spawn('node', [workerPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
        });

        // Handle stdout (responses)
        this.child.stdout?.setEncoding('utf8');
        this.child.stdout?.on('data', (chunk: string) => {
            this.buffer += chunk;

            const lines = this.buffer.split('\n');
            this.buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const response: EphemerisResponse = JSON.parse(line);
                    const pending = this.requestQueue.get(response.id);

                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.requestQueue.delete(response.id);

                        if (response.success) {
                            pending.resolve(response.result);
                        } else {
                            pending.reject(new Error(response.error || 'Unknown error'));
                        }
                    }
                } catch (error) {
                    console.error('[Ephemeris Isolation] Invalid response:', error);
                }
            }
        });

        // Handle stderr (logs)
        this.child.stderr?.setEncoding('utf8');
        this.child.stderr?.on('data', (chunk: string) => {
            console.error('[Ephemeris Worker stderr]:', chunk.trim());
        });

        // Handle unexpected exit
        this.child.on('exit', (code, signal) => {
            console.error(`[Ephemeris Worker] Exited with code ${code}, signal ${signal}`);

            // Reject all pending requests
            for (const [id, pending] of this.requestQueue.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(`Ephemeris worker crashed (exit code: ${code}, signal: ${signal})`));
            }
            this.requestQueue.clear();
            this.child = null;
        });

        // Handle errors
        this.child.on('error', (error) => {
            console.error('[Ephemeris Worker] Process error:', error);

            // Reject all pending requests
            for (const [id, pending] of this.requestQueue.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(`Ephemeris worker error: ${error.message}`));
            }
            this.requestQueue.clear();
            this.child = null;
        });
    }

    /**
     * Compute placements in isolated process
     */
    async computePlacements(payload: ReadingPayload, timeoutMs: number = 30000): Promise<any> {
        this.ensureWorker();

        if (!this.child || this.child.killed) {
            throw new Error('Failed to start ephemeris worker');
        }

        const requestId = `req-${this.nextRequestId++}`;
        const request: EphemerisRequest = { id: requestId, payload };

        return new Promise((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                this.requestQueue.delete(requestId);
                reject(new Error(`Ephemeris calculation timeout after ${timeoutMs}ms`));

                // Kill and restart worker on timeout
                if (this.child) {
                    this.child.kill('SIGKILL');
                    this.child = null;
                }
            }, timeoutMs);

            // Store pending request
            this.requestQueue.set(requestId, { resolve, reject, timeout });

            // Send request
            try {
                this.child!.stdin!.write(JSON.stringify(request) + '\n');
            } catch (error: any) {
                clearTimeout(timeout);
                this.requestQueue.delete(requestId);
                reject(new Error(`Failed to send request: ${error.message}`));
            }
        });
    }

    /**
     * Health check (uses same isolation)
     */
    async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
        try {
            const result = await this.computePlacements({
                birthDate: '2000-01-01',
                birthTime: '12:00',
                timezone: 'UTC',
                latitude: 0,
                longitude: 0,
                relationshipIntensity: 5,
                relationshipMode: 'sensual',
                primaryLanguage: 'en',
            }, 10000); // 10s timeout for health check

            if (result.sunSign === 'Capricorn') {
                return { status: 'ok', message: 'Ephemeris worker healthy' };
            }
            return { status: 'error', message: 'Unexpected test result' };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Shutdown worker gracefully
     */
    shutdown(): void {
        if (this.child) {
            this.child.kill('SIGTERM');
            this.child = null;
        }
    }
}

export const ephemerisIsolation = new EphemerisIsolation();
