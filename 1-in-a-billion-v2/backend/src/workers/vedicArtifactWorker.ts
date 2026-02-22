/**
 * VEDIC ARTIFACT WORKER (Audio)
 * 
 * Responsibilities:
 * 1. Poll vedic_job_artifacts for pending 'audio' tasks.
 * 2. Fetch Match Data (Score) & Profile Data (Names).
 * 3. Generate Audio via VedicAudioGenerator (OpenAI -> LameJS).
 * 4. Upload to Supabase Storage.
 * 5. Update Artifact Record.
 */

import { createClient } from '@supabase/supabase-js';
import { VedicAudioGenerator } from '../services/vedic/vedic_audio.generator';
import { VedicMatchResult } from '../services/vedic/vedic_ashtakoota.vectorized.engine';

// Init Clients
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const generator = new VedicAudioGenerator(process.env.OPENAI_API_KEY!);

const POLL_INTERVAL_MS = 2000;

async function runWorker() {
    console.log('Started Vedic Artifact Worker (Audio)...');
    while (true) {
        try {
            await processNextArtifact();
        } catch (error) {
            console.error('Artifact Worker Error:', error);
            await new Promise(r => setTimeout(r, 5000));
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
}

async function processNextArtifact() {
    // 1. Claim Task
    const { data: artifact, error: claimError } = await supabase
        .from('vedic_job_artifacts')
        .update({ status: 'processing' }) // Atomic claim?
        .eq('status', 'pending')
        .eq('artifact_type', 'audio')
        .limit(1)
        .select()
        .single();

    if (claimError || !artifact) return;

    console.log(`Processing Audio Artifact ${artifact.id} for Job ${artifact.job_id}`);

    try {
        const metadata = artifact.metadata || {};
        const { person_a_id, person_b_id } = metadata;

        if (!person_a_id || !person_b_id) {
            throw new Error('Missing person_a_id or person_b_id in artifact metadata');
        }

        // 2. Fetch Match Data
        // Need user_id from job to query vedic_matches strictly? Or just look up by pair?
        // Matches are unique by (user_id, person_a, person_b) pair.
        // We can get user_id from job.
        const { data: job } = await supabase.from('vedic_match_jobs').select('user_id').eq('id', artifact.job_id).single();
        if (!job) throw new Error('Job not found');

        const { data: matchRow, error: matchError } = await supabase
            .from('vedic_matches')
            .select('*')
            .eq('user_id', job.user_id)
            .eq('person_a', person_a_id)
            .eq('person_b', person_b_id)
            .single();

        if (matchError || !matchRow) {
            throw new Error(`Match result not found for ${person_a_id} + ${person_b_id}`);
        }

        // Reconstruct VedicMatchResult
        const matchVector: VedicMatchResult = {
            guna_total: matchRow.guna_total,
            guna_breakdown: matchRow.breakdown as any,
            dosha: {
                manglik: matchRow.manglik_dosha ? 'active' : 'none',
                nadi: matchRow.nadi_dosha,
                bhakoot: matchRow.bhakoot_dosha
            },
            dasha: {
                alignment_score: matchRow.dasha_sync,
                phase_relation: 'same' // Simplified - would need more data to determine
            },
            verdict_band: matchRow.classification as any
        };

        // 3. Fetch Profile Data (Names, Birth infos)
        // Tables: library_people or profiles? Assuming library_people for friend lists.
        const { data: profileA } = await supabase.from('library_people').select('*').eq('id', person_a_id).single();
        const { data: profileB } = await supabase.from('library_people').select('*').eq('id', person_b_id).single();

        if (!profileA || !profileB) throw new Error('Profiles not found in library_people');

        // Prepare info
        const infoA = {
            name: profileA.name,
            birthDate: profileA.birth_date, // YYYY-MM-DD
            birthTime: profileA.birth_time, // HH:mm:ss
            birthPlace: 'Unknown' // Library people might not have string place? Check schema.
        };
        const infoB = {
            name: profileB.name,
            birthDate: profileB.birth_date,
            birthTime: profileB.birth_time,
            birthPlace: 'Unknown'
        };

        // 4. Generate Audio
        const mp3Buffer = await generator.createAudiobook(matchVector, { a: infoA, b: infoB });

        // 5. Upload
        const fileName = `${job.user_id}/audiobooks/${artifact.id}.mp3`;
        const { error: uploadError } = await supabase.storage
            .from('vedic-artifacts') // user specific bucket? or general?
            .upload(fileName, mp3Buffer, {
                contentType: 'audio/mpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get Public URL (or signed)
        // Assuming public bucket for artifacts for now, or signed via UI?
        // Storing path is enough.

        const { data: publicData } = supabase.storage.from('vedic-artifacts').getPublicUrl(fileName);
        const publicUrl = publicData.publicUrl;

        // 6. Complete
        await supabase
            .from('vedic_job_artifacts')
            .update({
                status: 'complete',
                storage_path: fileName,
                metadata: {
                    ...metadata,
                    public_url: publicUrl,
                    duration_bytes: mp3Buffer.length
                }
            })
            .eq('id', artifact.id);

        console.log(`Audio artifact ${artifact.id} completed. Size: ${mp3Buffer.length} bytes.`);

    } catch (err: any) {
        console.error(`Artifact job ${artifact.id} failed:`, err);
        await supabase
            .from('vedic_job_artifacts')
            .update({
                status: 'failed',
                metadata: { error: err.message }
            })
            .eq('id', artifact.id);
    }
}

if (require.main === module) {
    runWorker();
}

export { runWorker };
