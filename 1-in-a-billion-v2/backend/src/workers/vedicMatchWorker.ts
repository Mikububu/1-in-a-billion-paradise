/**
 * VEDIC MATCHMAKING WORKER
 * Vectorized Batch Processing
 * 
 * Responsibilities:
 * 1. Claim queued jobs (one_to_many, many_to_many)
 * 2. Load numeric vectors from DB
 * 3. Execute O(1) vectorized matching
 * 4. Bulk insert results
 * 5. Update progress and status
 */

import { createClient } from '@supabase/supabase-js';
import {
    VedicPersonVector,
    matchBatch,
    matchVedicPair,
    VedicMatchResult
} from '../services/vedic/vedic_ashtakoota.vectorized.engine';

// Initialize Supabase Client (Service Role required)
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POLL_INTERVAL_MS = 1000;
const STALE_JOB_INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MINUTES = 15;

async function runWorker() {
    console.log('Started Vedic Matchmaking Worker...');

    await cleanupStaleJobs();
    setInterval(cleanupStaleJobs, STALE_JOB_INTERVAL_MS);

    while (true) {
        try {
            await processNextJob();
        } catch (error) {
            console.error('Worker loop error:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

async function cleanupStaleJobs() {
    try {
        const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();

        const { error } = await supabase
            .from('vedic_match_jobs')
            .update({ status: 'queued', error: 'Reset from stale state' })
            .eq('status', 'processing')
            .lt('updated_at', threshold);

        if (error) {
            console.error('Failed to cleanup stale jobs:', error);
        }
    } catch (err) {
        console.error('Error in cleanupStaleJobs:', err);
    }
}

async function processNextJob() {
    const { data: job, error: claimError } = await supabase
        .from('vedic_match_jobs')
        .update({ status: 'processing' })
        .eq('status', 'queued')
        .limit(1)
        .select()
        .single();

    if (claimError || !job) {
        return;
    }

    console.log(`Processing job ${job.id} (${job.job_type}) for user ${job.user_id}`);

    try {
        const { data: peopleRaw, error: loadError } = await supabase
            .from('vedic_people')
            .select('*')
            .eq('user_id', job.user_id);

        if (loadError || !peopleRaw || peopleRaw.length === 0) {
            throw new Error('No people found for user');
        }

        // Map DB schema to Vector (snake_case matches DB)
        const vectors: (VedicPersonVector & { person_id: string })[] = peopleRaw.map(row => ({
            person_id: row.person_id,
            gender: row.gender || 0,
            moon_rashi: row.moon_rashi,
            moon_nakshatra: row.moon_nakshatra,
            gana: row.gana,
            yoni: row.yoni,
            mars_house: row.mars_house,
            seventh_house_ruler: row.seventh_house_ruler || 0,
            dasha_lord: row.dasha_lord,
            mahadasha_index: row.dasha_lord
        }));

        let matches: (VedicMatchResult & { person_a_id: string, person_b_id: string })[] = [];

        if (job.job_type === 'many_to_many') {
            for (let i = 0; i < vectors.length; i++) {
                for (let j = i + 1; j < vectors.length; j++) {
                    const result = matchVedicPair(vectors[i], vectors[j]);
                    matches.push({
                        person_a_id: vectors[i].person_id,
                        person_b_id: vectors[j].person_id,
                        ...result
                    });
                }
            }
        } else if (job.job_type === 'one_to_many') {
            const source = vectors.find(v => {
                const row = peopleRaw.find(r => r.person_id === v.person_id);
                return row?.is_user === true;
            });

            if (!source) throw new Error('Source profile (is_user=true) not found');

            const candidates = vectors.filter(v => v.person_id !== source.person_id);

            // For large batches, use chunked processing
            if (candidates.length > 1000) {
                // Process in chunks and update progress
                const CHUNK_SIZE = 1000;
                const totalCandidates = candidates.length;
                
                for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
                    const chunk = candidates.slice(i, i + CHUNK_SIZE);
                    const chunkResults = matchBatch(source, chunk);
                    
                    const chunkMatches = chunkResults.map((result, idx) => ({
                        person_a_id: source.person_id,
                        person_b_id: chunk[idx]!.person_id,
                        ...result
                    }));
                    
                    matches.push(...chunkMatches);
                    
                    // Update progress (25-75% range for matching)
                    const progress = 25 + Math.floor((i + chunk.length) / totalCandidates * 50);
                    await supabase
                        .from('vedic_match_jobs')
                        .update({ progress })
                        .eq('id', job.id);
                }
                
                matches.sort((a, b) => b.guna_total - a.guna_total);
            } else {
                // Small batch - process all at once
                const results = matchBatch(source, candidates);
                matches = results.map((result, idx) => ({
                    person_a_id: source.person_id,
                    person_b_id: candidates[idx]!.person_id,
                    ...result
                }));
                matches.sort((a, b) => b.guna_total - a.guna_total);
            }
        } else {
            throw new Error(`Unsupported job type: ${job.job_type}`);
        }

        // Update progress before database insert
        await supabase
            .from('vedic_match_jobs')
            .update({ progress: 75 })
            .eq('id', job.id);

        if (matches.length > 0) {
            const dbRows = matches.map(m => ({
                user_id: job.user_id,
                person_a: m.person_a_id,
                person_b: m.person_b_id,
                guna_total: m.guna_total,
                classification: m.verdict_band,
                nadi_dosha: m.dosha.nadi,
                bhakoot_dosha: m.dosha.bhakoot,
                manglik_dosha: m.dosha.manglik === 'active',
                dasha_sync: m.dasha.alignment_score,
                breakdown: m.guna_breakdown
            }));

            // Insert in chunks to avoid large transactions
            const INSERT_CHUNK_SIZE = 500;
            for (let i = 0; i < dbRows.length; i += INSERT_CHUNK_SIZE) {
                const chunk = dbRows.slice(i, i + INSERT_CHUNK_SIZE);
                const { error: insertError } = await supabase
                    .from('vedic_matches')
                    .upsert(chunk, { onConflict: 'user_id, person_a, person_b' });

                if (insertError) throw insertError;
                
                // Update progress during inserts (75-95%)
                if (i + INSERT_CHUNK_SIZE < dbRows.length) {
                    const progress = 75 + Math.floor((i + INSERT_CHUNK_SIZE) / dbRows.length * 20);
                    await supabase
                        .from('vedic_match_jobs')
                        .update({ progress })
                        .eq('id', job.id);
                }
            }
        }

        await supabase
            .from('vedic_match_jobs')
            .update({
                status: 'complete',
                completed_at: new Date().toISOString(),
                progress: 100
            })
            .eq('id', job.id);

        console.log(`Job ${job.id} completed. Matches: ${matches.length}`);

    } catch (err: any) {
        console.error(`Job ${job.id} failed:`, err);
        await supabase
            .from('vedic_match_jobs')
            .update({
                status: 'failed',
                error: err.message,
                completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
    }
}

if (require.main === module) {
    runWorker();
}

export { runWorker, processNextJob };
