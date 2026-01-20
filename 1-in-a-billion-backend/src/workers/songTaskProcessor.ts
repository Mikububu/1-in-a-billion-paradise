/**
 * SONG TASK PROCESSOR
 * 
 * Core logic for processing song generation tasks.
 * Each document gets its own song - the text for that specific document
 * is sent to the LLM to generate lyrics, then to MiniMax for music.
 */

import { supabase } from '../services/supabaseClient';
import { generateLyrics } from '../services/lyricsGeneration';
import { generateSong, downloadSongAudio } from '../services/songGeneration';
import { logCost, MINIMAX_PRICING } from '../services/costTracking';

export interface SongTaskInput {
  docNum: number;        // Which document this song is for (1-16)
  docType: string;       // 'person1', 'person2', 'overlay', 'verdict', 'individual'
  system: string | null; // 'western', 'vedic', etc.
  personName: string;    // Name for lyrics
  // Legacy fields for backwards compatibility
  jobId?: string;
  userId?: string;
  relationshipContext?: string;
}

/**
 * Process a song generation task - ONE song per document
 */
export async function processSongTask(task: { id: string; job_id: string; input: SongTaskInput }): Promise<void> {
  const { job_id, input } = task;
  const { docNum, docType, system } = input;
  let { personName } = input;

  // CRITICAL FIX: Get correct person name from job params, not task input
  // Task input personName is unreliable (often defaults to 'User' from DB trigger)
  try {
    const { data: jobData } = await supabase!
      .from('jobs')
      .select('params')
      .eq('id', job_id)
      .single();
    
    const params = jobData?.params as any;
    if (params) {
      if (docType === 'person1' || docType === 'individual') {
        personName = params.person1?.name || params.person?.name || personName;
      } else if (docType === 'person2') {
        personName = params.person2?.name || personName;
      } else if (docType === 'overlay') {
        // For overlay, use both names combined
        const p1 = params.person1?.name || params.person?.name;
        const p2 = params.person2?.name;
        personName = p2 ? `${p1} and ${p2}` : p1 || personName;
      } else if (docType === 'verdict') {
        // For verdict, use both names combined
        const p1 = params.person1?.name || params.person?.name;
        const p2 = params.person2?.name;
        personName = p2 ? `${p1} and ${p2}` : p1 || personName;
      }
      console.log(`🎵 Resolved personName from job params: "${personName}" (docType: ${docType})`);
    }
  } catch (e) {
    console.warn('⚠️ Could not resolve person name from job params, using task input:', e);
  }

  // Final fallback if still 'User' or empty
  if (!personName || personName === 'User') {
    personName = 'this soul';
    console.warn('⚠️ personName was "User" or empty, using fallback: "this soul"');
  }

  console.log(`🎵 Processing song task ${task.id} for doc ${docNum} (${system || 'verdict'}) - ${personName}...`);

  try {
    // Step 1: Fetch the text artifact for THIS specific document
    const { data: artifacts, error: artifactsError } = await supabase!
      .from('job_artifacts')
      .select('*')
      .eq('job_id', job_id)
      .eq('artifact_type', 'text')
      .filter('metadata->>docNum', 'eq', String(docNum));

    if (artifactsError) {
      throw new Error(`Failed to fetch reading document: ${artifactsError.message}`);
    }

    if (!artifacts || artifacts.length === 0) {
      // Try alternate query (some artifacts might store docNum differently)
      const { data: altArtifacts, error: altError } = await supabase!
        .from('job_artifacts')
        .select('*')
        .eq('job_id', job_id)
        .eq('artifact_type', 'text');

      if (altError) throw new Error(`Failed to fetch reading documents: ${altError.message}`);

      // Find the artifact matching our docNum
      const matchingArtifact = altArtifacts?.find((a: any) =>
        a.metadata?.docNum === docNum ||
        Number(a.metadata?.docNum) === docNum ||
        a.metadata?.chapter_index === docNum - 1
      );

      if (!matchingArtifact) {
        throw new Error(`No reading document found for docNum ${docNum}`);
      }

      artifacts.push(matchingArtifact);
    }

    // Get text from the document
    const artifact = artifacts[0];
    let readingText = '';

    // Try storage_path first (text is stored in Supabase Storage)
    if (artifact.storage_path) {
      const { data: downloadData, error: downloadError } = await supabase!
        .storage
        .from('job-artifacts')
        .download(artifact.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download text from storage: ${downloadError.message}`);
      }

      readingText = await downloadData.text();
    } else if (artifact.content && typeof artifact.content === 'string') {
      readingText = artifact.content;
    } else if (artifact.metadata?.text) {
      readingText = artifact.metadata.text;
    }

    if (!readingText) {
      throw new Error(`Document ${docNum} has no text content`);
    }

    console.log(`📖 Processing document ${docNum}: ${readingText.length} chars`);

    // Step 2: Generate lyrics for this specific document
    const systemLabel = system ? system.replace('_', ' ').toUpperCase() : 'FINAL VERDICT';
    console.log(`✍️  Generating lyrics for ${personName}'s ${systemLabel}...`);

    const lyricsResult = await generateLyrics({
      personName,
      readingText,
      relationshipContext: input.relationshipContext,
      // Add context about which system this is for
      systemContext: system ? `This is a ${system} astrology reading.` : 'This is the final synthesis.',
    });

    console.log(`✅ Lyrics generated (${lyricsResult.lyrics.length} chars)`);
    if (lyricsResult.title) {
      console.log(`   Title: ${lyricsResult.title}`);
    }

    // Step 3: Generate song with MiniMax
    console.log(`🎵 Generating song for doc ${docNum}...`);
    // MiniMax is sensitive to very long lyric payloads. Keep this bounded and ensure
    // the subject name remains present even after trimming.
    const MAX_LYRICS_CHARS = 1400;
    let safeLyrics = lyricsResult.lyrics || '';
    if (safeLyrics.length > MAX_LYRICS_CHARS) {
      safeLyrics = safeLyrics.slice(0, MAX_LYRICS_CHARS).trim();
    }
    if (personName && !safeLyrics.toLowerCase().includes(personName.toLowerCase())) {
      safeLyrics = `${safeLyrics}\n\n${personName}.`;
    }
    // Fetched dynamic persona config
    let personas: any[] = [];
    try {
      const { data: configData, error: configError } = await supabase!
        .from('assistant_config')
        .select('minimax_personas')
        .single();

      if (configData?.minimax_personas) {
        personas = configData.minimax_personas;
        console.log(`🎛️  Using dynamic persona mix: ${personas.map((p: any) => `${p.name}:${p.weight}%`).join(', ')}`);
      }
    } catch (e) {
      console.warn("Could not fetch assistant_config for personas, using default.");
    }

    const songResult = await generateSong({
      lyrics: safeLyrics,
      personName,
      style: lyricsResult.style || 'pop',
      emotion: lyricsResult.emotion || 'emotional',
      duration: 180, // 3 minutes
      personas,
      customPrompt: lyricsResult.minimaxPrompt, // NEW: Use LLM's custom prompt!
    });

    // Step 4: Get audio data (download if URL, use base64 if available)
    let audioBase64: string;
    if (songResult.audioBase64) {
      audioBase64 = songResult.audioBase64;
    } else if (songResult.audioUrl) {
      console.log('📥 Downloading audio from URL...');
      audioBase64 = await downloadSongAudio(songResult.audioUrl);
    } else {
      throw new Error('No audio data available from MiniMax');
    }
    
    // 💰 LOG MINIMAX COST for this song generation
    await logCost({
      jobId: job_id,
      taskId: task.id,
      provider: 'minimax',
      model: 'music-01',
      costUsd: MINIMAX_PRICING.perSong,
      label: `song_${system || 'verdict'}_${docType}`,
    });

    // Step 5: Upload to Supabase Storage (matching frontend format)
    // Get job params to extract both person names (for synastry songs)
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('params, user_id')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to get job: ${jobError?.message}`);
    }

    const params: any = job.params || {};

    // Clean function matching frontend cleanForFilename()
    const cleanForFilename = (str: string): string => {
      if (!str || typeof str !== 'string') return 'Unknown';
      return str
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, '_')           // Spaces to underscores
        .replace(/_+/g, '_')            // Collapse multiple underscores
        .replace(/^_|_$/g, '');         // Trim leading/trailing underscores
    };

    const person1Name = cleanForFilename(params?.person1?.name || params?.person1Name || 'Person1');
    const person2Name = params?.person2?.name ? cleanForFilename(params.person2.name) : null;
    const systemName = system ? cleanForFilename(system.charAt(0).toUpperCase() + system.slice(1)) : 'Verdict';

    // ⚠️ CRITICAL: Follow TEXT_READING_SPEC.md § 3.3 - DocType Data Scoping Rule
    // See: docs/CRITICAL_RULES_CHECKLIST.md Rule 1
    // Generate filename matching frontend format:
    // Individual/person1/person2: PersonName_SystemName_song.mp3
    // Synastry/Overlay: Person1_Person2_System_song.mp3
    let fileName: string;
    if (person2Name && (docType === 'overlay' || docType === 'synastry')) {
      fileName = `${person1Name}_${person2Name}_${systemName}_song.mp3`;
    } else {
      fileName = `${person1Name}_${systemName}_song.mp3`;
    }

    // Storage path matching baseWorker structure
    const storagePath = `${job.user_id}/${job_id}/song/${fileName}`;

    console.log(`📤 Uploading song to storage: ${storagePath}...`);
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const { data: uploadData, error: uploadError } = await supabase!.storage
      .from('job-artifacts')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload song: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase!.storage
      .from('job-artifacts')
      .getPublicUrl(storagePath);

    const storageUrl = publicUrlData.publicUrl;
    console.log(`✅ Song uploaded: ${storageUrl}`);

    // Step 6: Create artifact record (with docNum for matching)
    const { error: artifactError } = await supabase!
      .from('job_artifacts')
      .insert({
        job_id: job_id,
        task_id: task.id,
        artifact_type: 'audio_song',
        storage_path: storagePath,
        public_url: storageUrl,
        metadata: {
          docNum,
          docType,
          system,
          title: lyricsResult.title || `${systemLabel} Song - ${personName}`,
          lyrics: lyricsResult.lyrics,
          duration: songResult.duration,
          style: lyricsResult.style,
          traceId: songResult.traceId,
        },
      });

    if (artifactError) {
      throw new Error(`Failed to create artifact: ${artifactError.message}`);
    }

    console.log(`✅ Song task ${task.id} (doc ${docNum}) completed successfully!`);
  } catch (error: any) {
    console.error(`❌ Song task ${task.id} (doc ${docNum}) failed:`, error);
    throw error;
  }
}

