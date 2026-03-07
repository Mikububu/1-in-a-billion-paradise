/**
 * PDF WORKER - PDF Generation
 *
 * Processes pdf_generation tasks:
 * - Reads text from previous text_generation task (via Storage)
 * - Generates PDF using pdfGenerator
 * - Uploads PDF artifact to Supabase Storage
 */
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask } from '../services/supabaseClient';
export declare class PdfWorker extends BaseWorker {
    constructor();
    protected processTask(task: JobTask): Promise<TaskResult>;
}
//# sourceMappingURL=pdfWorker.d.ts.map