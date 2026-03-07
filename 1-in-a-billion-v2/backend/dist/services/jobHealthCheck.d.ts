/**
 * JOB HEALTH CHECK SERVICE
 *
 * Automatically cleans up stuck jobs and retries failed tasks.
 * Runs every 5 minutes to ensure system resilience.
 *
 * Features:
 * - Auto-fail jobs stuck in 'queued' for > 30 minutes
 * - Auto-fail tasks stuck in 'pending'/'processing' beyond timeout
 * - Auto-retry failed tasks up to max_attempts
 */
declare class JobHealthCheckService {
    private intervalId;
    private isRunning;
    private CHECK_INTERVAL_MS;
    /**
     * Start the health check service
     */
    start(): void;
    /**
     * Stop the health check service
     */
    stop(): void;
    /**
     * Run the health check (can be called manually)
     */
    runHealthCheck(): Promise<void>;
    /**
     * Get service status
     */
    getStatus(): {
        isRunning: boolean;
        checkIntervalMs: number;
        checkIntervalMinutes: number;
    };
}
export declare const jobHealthCheck: JobHealthCheckService;
export {};
//# sourceMappingURL=jobHealthCheck.d.ts.map