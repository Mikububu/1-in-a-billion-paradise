/**
 * PDF WORKER - PDF Generation
 *
 * Processes pdf_generation tasks:
 * - Reads text from previous text_generation task (via Storage)
 * - Generates PDF using pdfGenerator
 * - Uploads PDF artifact to Supabase Storage
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { generateChapterPDF } from '../services/pdf/pdfGenerator';

export class PdfWorker extends BaseWorker {
  constructor() {
    super({
      taskTypes: ['pdf_generation'],
      maxConcurrentTasks: 5, // PDF generation is CPU-bound, limit concurrency
    });
  }

  protected async processTask(task: JobTask): Promise<TaskResult> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const jobId = task.job_id;
    const textArtifactPath = task.input?.textArtifactPath as string | undefined;
    const title = (task.input?.title as string) || 'Reading';
    const docNum = (task.input?.docNum as number) || 1;
    const docType = (task.input?.docType as string) || 'individual';
    const system = (task.input?.system as string) || 'western';

    if (!textArtifactPath) {
      return { success: false, error: 'Missing textArtifactPath in task input' };
    }

    // Download text from Storage
    console.log(`📥 Downloading text artifact: ${textArtifactPath}`);
    const { data: textData, error: downloadError } = await supabase.storage
      .from('job-artifacts')
      .download(textArtifactPath);

    if (downloadError || !textData) {
      return { success: false, error: `Failed to download text: ${downloadError?.message || 'unknown'}` };
    }

    const textBuffer = Buffer.from(await textData.arrayBuffer());
    const text = textBuffer.toString('utf-8');

    if (!text || text.length < 100) {
      return { success: false, error: 'Text artifact is empty or too short' };
    }

    console.log(`📄 Generating PDF for chapter ${docNum}: ${title} (${text.length} chars)`);

    // Get job params to extract person names and user_id
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('params, user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { success: false, error: `Failed to load job: ${jobError?.message || 'unknown'}` };
    }

    const params: any = job.params || {};
    const userId = job.user_id;
    const person1 = params.person1 || { name: 'Person 1', birthDate: '' };
    const person2 = params.person2 || undefined;

    // Generate PDF
    try {
      const { filePath, pageCount } = await generateChapterPDF(
        docNum,
        {
          title: title,
          system: system,
          person1Reading: docType === 'person1' || docType === 'individual' ? text : undefined,
          person2Reading: docType === 'person2' ? text : undefined,
          overlayReading: docType === 'overlay' ? text : undefined,
          verdict: docType === 'verdict' ? text : undefined,
        },
        {
          name: person1.name,
          birthDate: person1.birthDate || '',
          sunSign: person1.sunSign,
          moonSign: person1.moonSign,
          risingSign: person1.risingSign,
        },
        person2
          ? {
              name: person2.name,
              birthDate: person2.birthDate || '',
              sunSign: person2.sunSign,
              moonSign: person2.moonSign,
              risingSign: person2.risingSign,
            }
          : undefined
      );

      // Read PDF file
      const pdfBuffer = await require('fs').promises.readFile(filePath);

      // Determine storage path (same pattern as text artifacts)
      const artifactType = 'pdf' as const;
      const extension = 'pdf';
      const pdfArtifactPath = `${userId}/${jobId}/${artifactType}/${task.id}.${extension}`;

      return {
        success: true,
        output: {
          docNum,
          docType,
          system,
          title,
          pageCount,
          pdfArtifactPath,
        },
        artifacts: [
          {
            type: 'pdf',
            buffer: pdfBuffer,
            contentType: 'application/pdf',
            metadata: {
              jobId,
              docNum,
              docType,
              system,
              title,
              pageCount,
            },
          },
        ],
      };
    } catch (error: any) {
      console.error(`❌ PDF generation failed:`, error);
      return { success: false, error: `PDF generation failed: ${error.message || 'unknown error'}` };
    }
  }
}

if (require.main === module) {
  const worker = new PdfWorker();
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());

  worker.start().catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
  });
}

