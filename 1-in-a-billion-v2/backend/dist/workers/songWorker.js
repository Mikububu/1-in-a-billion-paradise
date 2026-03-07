"use strict";
/**
 * SONG WORKER
 *
 * Processes song generation tasks for nuclear_v2 jobs.
 * Extends BaseWorker to handle song_generation tasks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongWorker = void 0;
const baseWorker_1 = require("./baseWorker");
const songTaskProcessor_1 = require("./songTaskProcessor");
class SongWorker extends baseWorker_1.BaseWorker {
    constructor() {
        super({
            taskTypes: ['song_generation'],
            maxConcurrentTasks: 1, // Only process one song at a time (API rate limits)
            pollingIntervalMs: 10000, // Check every 10 seconds
            maxPollingIntervalMs: 60000, // Max 1 minute between checks
        });
    }
    /**
     * Process a song generation task
     */
    async processTask(task) {
        try {
            const result = await (0, songTaskProcessor_1.processSongTask)(task);
            if (result.success) {
                return {
                    success: true,
                    output: {
                        message: 'Song generated successfully',
                    },
                };
            }
            else {
                // Song failed but error artifact was created - report as success
                // so the job pipeline continues, but include the error details
                return {
                    success: true,
                    output: {
                        message: `Song generation failed gracefully: ${result.error}`,
                        songError: true,
                    },
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Song generation failed',
            };
        }
    }
}
exports.SongWorker = SongWorker;
// Run if called directly (Fly process group: song-worker)
if (require.main === module) {
    const worker = new SongWorker();
    process.on('SIGTERM', () => worker.stop());
    process.on('SIGINT', () => worker.stop());
    worker.start().catch((error) => {
        console.error('Fatal song worker error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=songWorker.js.map