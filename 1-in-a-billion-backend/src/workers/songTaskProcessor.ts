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
  const { docNum, docType, system, personName } = input;

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
    const songResult = await generateSong({
      lyrics: lyricsResult.lyrics,
      personName,
      style: lyricsResult.style || 'dark_poetic',
      emotion: 'intimate',
      duration: 180, // 3 minutes
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
    
    // Generate filename matching frontend format:
    // Individual: PersonName_SystemName_song.mp3
    // Synastry/Overlay: Person1_Person2_System_song.mp3
    let fileName: string;
    if (person2Name && (docType === 'overlay' || docType === 'synastry' || docType === 'person2')) {
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

