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
import { getCoupleImage } from '../services/coupleImageService';
import { getSystemDisplayName } from '../config/systemConfig';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    console.log(`   📋 DocType: ${docType}`);
    console.log(`   🔖 System: ${system}`);

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

    // ─── Fetch chart reference page from source text task output ──────────────
    let chartReferencePage: string | undefined;
    let chartReferencePageRight: string | undefined;
    const sourceTaskId = task.input?.sourceTaskId as string | undefined;
    if (sourceTaskId) {
      try {
        const { data: srcTask, error: srcErr } = await supabase
          .from('job_tasks')
          .select('output')
          .eq('id', sourceTaskId)
          .single();
        if (!srcErr && srcTask?.output) {
          chartReferencePage = srcTask.output.chartReferencePage as string | undefined;
          chartReferencePageRight = srcTask.output.chartReferencePageRight as string | undefined;
          if (chartReferencePage) {
            console.log(`   📋 Chart reference page loaded from text task (${chartReferencePage.length} chars)`);
          }
        }
      } catch {
        console.warn('   ⚠️ Could not load chart reference page from source text task');
      }
    }
    const person1 = params.person1 || { name: 'Person 1', birthDate: '' };
    const person2 = params.person2 || undefined;
    let person1Id: string | undefined = person1?.id;
    let person2Id: string | undefined = person2?.id;

    const getPortraitUrl = async (clientPersonId?: string, personName?: string): Promise<{ url: string | null; id: string | null }> => {
      // Try by client_person_id first
      if (clientPersonId) {
        try {
          const { data, error } = await supabase
            .from('library_people')
            .select('portrait_url, original_photo_url, client_person_id')
            .eq('user_id', userId)
            .eq('client_person_id', clientPersonId)
            .maybeSingle();
          if (!error && data) {
            const url = (data.portrait_url || data.original_photo_url) as string | null;
            return { url, id: data.client_person_id };
          }
        } catch {
          // ignore
        }
      }

      // Fallback 1: Try by name if ID not provided or not found
      if (personName) {
        try {
          const { data, error } = await supabase
            .from('library_people')
            .select('portrait_url, original_photo_url, client_person_id')
            .eq('user_id', userId)
            .ilike('name', personName)
            .maybeSingle();
          if (!error && data) {
            console.log(`   ℹ️  Found portrait for ${personName} by name (ID: ${data.client_person_id})`);
            const url = (data.portrait_url || data.original_photo_url) as string | null;
            return { url, id: data.client_person_id };
          }
        } catch {
          // ignore
        }
      }

      // Fallback 2: if the ID doesn't match a client_person_id (self profile often uses is_user=true),
      // fall back to the self profile.
      try {
        const { data, error } = await supabase
          .from('library_people')
          .select('portrait_url, original_photo_url, client_person_id')
          .eq('user_id', userId)
          .eq('is_user', true)
          .maybeSingle();
        if (!error && data) {
          const url = (data.portrait_url || data.original_photo_url) as string | null;
          return { url, id: data.client_person_id };
        }
      } catch {
        // ignore
      }

      return { url: null, id: null };
    };

    const getCoupleImageUrl = async (a?: string, b?: string): Promise<string | null> => {
      if (!a || !b) return null;
      const [p1, p2] = a < b ? [a, b] : [b, a];
      try {
        const { data, error} = await supabase
          .from('couple_portraits')
          .select('couple_image_url')
          .eq('user_id', userId)
          .eq('person1_id', p1)
          .eq('person2_id', p2)
          .maybeSingle();
        if (!error && data?.couple_image_url) return data.couple_image_url as string;
      } catch {
        // ignore
      }
      return null;
    };

    // If portraits are still being generated, wait briefly so PDFs can include them.
    // This prevents "empty image" PDFs right after a new photo upload.
    const maxWaitMs = 60_000;
    const pollMs = 3_000;
    const startedAt = Date.now();

    let person1PortraitUrl: string | null = null;
    let person2PortraitUrl: string | null = null;
    let existingCoupleImageUrl: string | null = null;

    while (Date.now() - startedAt < maxWaitMs) {
      const [p1Result, p2Result, c] = await Promise.all([
        getPortraitUrl(person1Id, person1?.name),
        getPortraitUrl(person2Id, person2?.name),
        getCoupleImageUrl(person1Id, person2Id),
      ]);

      person1PortraitUrl = p1Result.url;
      person2PortraitUrl = p2Result.url;
      existingCoupleImageUrl = c;
      
      // Update person IDs if we found them by name
      if (!person1Id && p1Result.id) person1Id = p1Result.id;
      if (!person2Id && p2Result.id) person2Id = p2Result.id;

      // For single PDFs we only need p1. For overlay PDFs we want p1+p2 (and ideally couple image).
      const hasSingleReady = !!person1PortraitUrl;
      const hasOverlayReady = !person2 || (!!person1PortraitUrl && !!person2PortraitUrl);
      if (hasSingleReady && hasOverlayReady) break;

      await sleep(pollMs);
    }

    let coupleImageUrl = existingCoupleImageUrl;
    if (!coupleImageUrl && person1PortraitUrl && person2PortraitUrl && person1Id && person2Id) {
      // ⚠️ CRITICAL: Ensure we're using styled portraits, not original photos
      // getPortraitUrl() prefers portrait_url, but falls back to original_photo_url
      const isStyled1 = person1PortraitUrl.includes('/AI-generated-portrait.png');
      const isStyled2 = person2PortraitUrl.includes('/AI-generated-portrait.png');
      
      if (!isStyled1 || !isStyled2) {
        console.warn('⚠️ [PDFWorker] WARNING: Portrait URLs appear to be original photos, not styled portraits!');
        console.warn(`   Person 1 styled: ${isStyled1} (${person1PortraitUrl})`);
        console.warn(`   Person 2 styled: ${isStyled2} (${person2PortraitUrl})`);
        console.warn('   Couple portraits should use styled portraits for best results.');
        console.warn('   The system will proceed, but facial features may not be preserved correctly.');
      }
      
      // Ensure couple image exists for synastry PDFs (generate if missing/outdated)
      const res = await getCoupleImage(userId, person1Id, person2Id, person1PortraitUrl, person2PortraitUrl, false);
      if (res.success && res.coupleImageUrl) {
        coupleImageUrl = res.coupleImageUrl;
      }
    }

    // Generate PDF
    try {
      // ⚠️ CRITICAL: Follow TEXT_READING_SPEC.md § 3.3 - DocType Data Scoping Rule
      // See: docs/CRITICAL_RULES_CHECKLIST.md Rule 1
      // person1 docs → ONLY person1 data
      // person2 docs → ONLY person2 data
      // overlay/verdict docs → BOTH people
      
      const isPerson2Reading = docType === 'person2';
      const isOverlayReading = docType === 'overlay' || docType === 'verdict';
      
      // Determine which person to show in the PDF
      const pdfPerson1 = isPerson2Reading && person2 ? person2 : person1;
      const pdfPerson1Portrait = isPerson2Reading ? person2PortraitUrl : person1PortraitUrl;
      
      // Only include person2 for overlay readings (NOT for single person readings)
      const pdfPerson2 = isOverlayReading && person2 ? person2 : undefined;
      const pdfPerson2Portrait = isOverlayReading ? person2PortraitUrl : undefined;
      
      // ⚠️ CRITICAL VALIDATION: Ensure correct content routing
      // This prevents the bug where same content is used for all PDFs
      console.log(`   👤 PDF will show:`);
      console.log(`      Person 1: ${pdfPerson1.name}`);
      if (pdfPerson2) console.log(`      Person 2: ${pdfPerson2.name}`);
      console.log(`   📝 Content type: ${docType}`);
      
      // Validate: person2 readings must have person2 data
      if (docType === 'person2' && !person2) {
        return { success: false, error: 'CRITICAL: person2 reading requested but no person2 in job params' };
      }
      
      // Validate: overlay readings must have both people
      if ((docType === 'overlay' || docType === 'verdict') && !person2) {
        return { success: false, error: 'CRITICAL: overlay/verdict reading requested but no person2 in job params' };
      }
      
      // ⚠️ CRITICAL: Route text to correct field based on docType
      // For person2 docs, we treat person2 as "person1" in the PDF layout (single-person PDF)
      // So the content should go in person1Reading, not person2Reading
      
      // Generate proper PDF title: "System Display Name - Person Name"
      // See docs/PDF_STYLE_GUIDE.md: Format: "System Name - Person Name"
      const systemDisplayName = getSystemDisplayName(system);
      let pdfTitle: string;
      if (isOverlayReading) {
        pdfTitle = `${systemDisplayName} - ${person1.name} & ${person2?.name || 'Partner'}`;
      } else if (isPerson2Reading && person2) {
        pdfTitle = `${systemDisplayName} - ${person2.name}`;
      } else {
        pdfTitle = `${systemDisplayName} - ${person1.name}`;
      }
      console.log(`   📝 PDF Title: ${pdfTitle}`);
      
      const chapterContent = {
        title: pdfTitle,
        system: system,
        person1Reading: (docType === 'person1' || docType === 'individual' || docType === 'person2') ? text : undefined,
        person2Reading: undefined, // Only used for overlay PDFs where we show both people
        overlayReading: docType === 'overlay' ? text : undefined,
        verdict: docType === 'verdict' ? text : undefined,
      };
      
      // Validate: exactly ONE reading field should have content
      const contentFields = [
        chapterContent.person1Reading,
        chapterContent.person2Reading,
        chapterContent.overlayReading,
        chapterContent.verdict,
      ].filter(Boolean);
      
      if (contentFields.length === 0) {
        return { success: false, error: `CRITICAL: No reading content assigned for docType=${docType}` };
      }
      if (contentFields.length > 1) {
        return { success: false, error: `CRITICAL: Multiple reading fields assigned for docType=${docType}. Only one should have content.` };
      }
      
      console.log(`   ✅ Content validation passed: 1 field assigned (${text.length} chars)`);
      
      const { filePath, pageCount } = await generateChapterPDF(
        docNum,
        chapterContent,
        {
          name: pdfPerson1.name,
          birthDate: pdfPerson1.birthDate || '',
          birthTime: pdfPerson1.birthTime,
          birthPlace: pdfPerson1.birthPlace,
          timezone: pdfPerson1.timezone,
          sunSign: pdfPerson1.sunSign,
          moonSign: pdfPerson1.moonSign,
          risingSign: pdfPerson1.risingSign,
          portraitUrl: pdfPerson1Portrait || undefined,
        },
        pdfPerson2
          ? {
              name: pdfPerson2.name,
              birthDate: pdfPerson2.birthDate || '',
              birthTime: pdfPerson2.birthTime,
              birthPlace: pdfPerson2.birthPlace,
              timezone: pdfPerson2.timezone,
              sunSign: pdfPerson2.sunSign,
              moonSign: pdfPerson2.moonSign,
              risingSign: pdfPerson2.risingSign,
              portraitUrl: pdfPerson2Portrait || undefined,
            }
          : undefined
        ,
        // CRITICAL: Only pass couple image for overlay/verdict readings
        // Single-person PDFs must show solo portrait, NOT couple image
        isOverlayReading ? (coupleImageUrl || undefined) : undefined,
        // Chart reference and compatibility data for PDF pages
        {
          chartReferencePage,
          chartReferencePageRight,
        }
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
