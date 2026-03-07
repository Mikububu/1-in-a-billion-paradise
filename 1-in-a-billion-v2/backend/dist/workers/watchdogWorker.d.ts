/**
 * WATCHDOG WORKER - Reclaim Stale Tasks, Finalize Stuck Jobs, Send Notifications
 *
 * Runs every 60 seconds to:
 * 1. Reclaim stale tasks (unstick zombie tasks whose workers crashed)
 * 2. Finalize stuck jobs (mark as complete/error when all tasks are done+failed)
 * 3. Send notifications for newly completed jobs
 */
declare function start(): Promise<void>;
export { start as startWatchdog };
//# sourceMappingURL=watchdogWorker.d.ts.map