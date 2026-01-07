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
import { uploadToSupabaseStorage } from '../services/storage';

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
      const matchingArtifact = altArtifacts?.find(a => 
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
    if (artifact.content && typeof artifact.content === 'string') {
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

    // Step 5: Upload to Supabase Storage (with docNum in filename)
    const fileName = `song_doc${docNum}_${Date.now()}.mp3`;
    const storagePath = `jobs/${job_id}/${fileName}`;

    console.log(`📤 Uploading song to storage: ${storagePath}...`);
    const { url: storageUrl, error: uploadError } = await uploadToSupabaseStorage({
      bucket: 'job-artifacts',
      path: storagePath,
      file: Buffer.from(audioBase64, 'base64'),
      contentType: 'audio/mpeg',
      userId: input.userId || 'system',
    });

    if (uploadError || !storageUrl) {
      throw new Error(`Failed to upload song: ${uploadError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Song uploaded: ${storageUrl}`);

    // Step 6: Create artifact record (with docNum for matching)
    const { error: artifactError } = await supabase!
      .from('job_artifacts')
      .insert({
        job_id: job_id,
        task_id: task.id,
        artifact_type: 'audio_song',
        storage_path: storagePath,
        storage_url: storageUrl,
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

