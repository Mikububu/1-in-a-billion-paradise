/**
 * SONG TASK PROCESSOR
 *
 * Core logic for processing song generation tasks.
 * Each document gets its own song - the text for that specific document
 * is sent to the LLM to generate lyrics, then to MiniMax for music.
 */
export interface SongTaskInput {
    docNum: number;
    docType: string;
    system: string | null;
    personName: string;
    jobId?: string;
    userId?: string;
    relationshipContext?: string;
}
/**
 * Process a song generation task - ONE song per document
 */
export declare function processSongTask(task: {
    id: string;
    job_id: string;
    input: SongTaskInput;
}): Promise<{
    success: boolean;
    error?: string;
}>;
//# sourceMappingURL=songTaskProcessor.d.ts.map