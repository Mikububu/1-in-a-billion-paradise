"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobHealthCheck = void 0;
const supabaseClient_1 = require("./supabaseClient");
class JobHealthCheckService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Start the health check service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Job health check already running');
            return;
        }
        this.isRunning = true;
        console.log('🏥 Starting job health check service (runs every 5 minutes)');
        // Run immediately on start
        this.runHealthCheck();
        // Then run every 5 minutes
        this.intervalId = setInterval(() => {
            this.runHealthCheck();
        }, this.CHECK_INTERVAL_MS);
    }
    /**
     * Stop the health check service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Job health check service stopped');
    }
    /**
     * Run the health check (can be called manually)
     */
    async runHealthCheck() {
        try {
            console.log('🏥 Running job health check...');
            const { data, error } = await supabaseClient_1.supabase.rpc('run_job_health_check');
            if (error) {
                console.error('❌ Health check failed:', error.message);
                // If RPC doesn't exist, provide helpful error
                if (error.code === '42883') {
                    console.error('💡 Run migration 021_add_timeouts_and_retries.sql to enable health checks');
                }
                return;
            }
            console.log('✅ Health check complete');
        }
        catch (error) {
            console.error('❌ Health check error:', error.message);
        }
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkIntervalMs: this.CHECK_INTERVAL_MS,
            checkIntervalMinutes: this.CHECK_INTERVAL_MS / 60000,
        };
    }
}
// Singleton instance
exports.jobHealthCheck = new JobHealthCheckService();
// Auto-start if this module is imported (can be disabled with env var)
if (process.env.DISABLE_AUTO_HEALTH_CHECK !== 'true') {
    // Start after 10 seconds to allow app to fully initialize
    setTimeout(() => {
        exports.jobHealthCheck.start();
    }, 10000);
}
//# sourceMappingURL=jobHealthCheck.js.map