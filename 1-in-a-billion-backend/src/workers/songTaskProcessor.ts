/**
 * SONG TASK PROCESSOR
 * 
 * Core logic for processing song generation tasks.
 * Separated from worker for testability.
 */

import { supabase } from '../services/supabaseClient';
import { generateLyrics } from '../services/lyricsGeneration';
import { generateSong, downloadSongAudio } from '../services/songGeneration';
import { uploadToSupabaseStorage } from '../services/storage';

export interface SongTaskInput {
  jobId: string;
  userId: string;
  personName: string;
  relationshipContext?: string;
}

/**
 * Process a song generation task
 */
export async function processSongTask(task: { id: string; job_id: string; input: SongTaskInput }): Promise<void> {
  const { job_id, input } = task;
  const { userId, personName, relationshipContext } = input;

  console.log(`🎵 Processing song task ${task.id} for job ${job_id}...`);

  try {
    // Step 1: Fetch all completed reading documents for this job
    const { data: artifacts, error: artifactsError } = await supabase!
      .from('job_artifacts')
      .select('*')
      .eq('job_id', job_id)
      .eq('artifact_type', 'text')
      .order('created_at', { ascending: true });

    if (artifactsError) {
      throw new Error(`Failed to fetch reading documents: ${artifactsError.message}`);
    }

    if (!artifacts || artifacts.length === 0) {
      throw new Error('No reading documents found for song generation');
    }

    // Combine all reading text
    const readingTexts: string[] = [];
    for (const artifact of artifacts) {
      if (artifact.content && typeof artifact.content === 'string') {
        readingTexts.push(artifact.content);
      } else if (artifact.metadata?.text) {
        readingTexts.push(artifact.metadata.text);
      }
    }

    const combinedReadingText = readingTexts.join('\n\n---\n\n');
    console.log(`📖 Combined ${readingTexts.length} reading documents (${combinedReadingText.length} chars)`);

    // Step 2: Generate lyrics
    console.log('✍️  Generating lyrics...');
    const lyricsResult = await generateLyrics({
      personName,
      readingText: combinedReadingText,
      relationshipContext,
    });

    console.log(`✅ Lyrics generated (${lyricsResult.lyrics.length} chars)`);
    if (lyricsResult.title) {
      console.log(`   Title: ${lyricsResult.title}`);
    }

    // Step 3: Generate song
    console.log('🎵 Generating song with MiniMax...');
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

    // Step 5: Upload to Supabase Storage
    const fileName = `song_${job_id}_${Date.now()}.mp3`;
    const storagePath = `jobs/${job_id}/${fileName}`;

    console.log(`📤 Uploading song to storage: ${storagePath}...`);
    const { url: storageUrl, error: uploadError } = await uploadToSupabaseStorage({
      bucket: 'job-artifacts',
      path: storagePath,
      file: Buffer.from(audioBase64, 'base64'),
      contentType: 'audio/mpeg',
      userId,
    });

    if (uploadError || !storageUrl) {
      throw new Error(`Failed to upload song: ${uploadError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Song uploaded: ${storageUrl}`);

    // Step 6: Create artifact record
    const { error: artifactError } = await supabase!
      .from('job_artifacts')
      .insert({
        job_id: job_id,
        task_id: task.id,
        artifact_type: 'audio_song',
        storage_path: storagePath,
        storage_url: storageUrl,
        metadata: {
          title: lyricsResult.title || `Song for ${personName}`,
          lyrics: lyricsResult.lyrics,
          duration: songResult.duration,
          style: lyricsResult.style,
          traceId: songResult.traceId,
        },
      });

    if (artifactError) {
      throw new Error(`Failed to create artifact: ${artifactError.message}`);
    }

    console.log(`✅ Song task ${task.id} completed successfully!`);
  } catch (error: any) {
    console.error(`❌ Song task ${task.id} failed:`, error);
    throw error;
  }
}

