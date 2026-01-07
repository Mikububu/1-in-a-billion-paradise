/**
 * SONG WORKER
 * 
 * Processes song generation tasks for nuclear_v2 jobs.
 * Extends BaseWorker to handle song_generation tasks.
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { processSongTask } from './songTaskProcessor';

export class SongWorker extends BaseWorker {
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
  protected async processTask(task: any): Promise<TaskResult> {
    try {
      await processSongTask(task);
      
      return {
        success: true,
        output: {
          message: 'Song generated successfully',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Song generation failed',
      };
    }
  }
}
