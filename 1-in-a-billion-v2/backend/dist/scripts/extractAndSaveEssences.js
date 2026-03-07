"use strict";
/**
 * Extract and Save System Essences
 *
 * This script extracts essences from completed readings and saves them to people profiles.
 * Run this after job completion or as a batch process to populate essences for existing readings.
 *
 * Usage:
 *   npx tsx src/scripts/extractAndSaveEssences.ts <jobId>
 *   npx tsx src/scripts/extractAndSaveEssences.ts --all  (process all completed jobs)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const essenceExtractionService_1 = require("../services/essenceExtractionService");
async function extractEssencesForJob(jobId) {
    console.log(`\n📊 Processing job ${jobId}...`);
    // Get job params to find person IDs
    const { data: job, error: jobError } = await supabaseClient_1.supabase
        .from('jobs')
        .select('params, user_id, product_type')
        .eq('id', jobId)
        .single();
    if (jobError || !job) {
        console.error(`❌ Failed to load job:`, jobError);
        return;
    }
    const params = job.params || {};
    const person1Id = params.person1?.id || params.person1_id;
    const person2Id = params.person2?.id || params.person2_id;
    if (!person1Id) {
        console.log(`⚠️  No person1 ID in job params, skipping`);
        return;
    }
    // Get all text artifacts for this job
    const { data: artifacts, error: artifactsError } = await supabaseClient_1.supabase
        .from('job_artifacts')
        .select('*')
        .eq('job_id', jobId)
        .eq('artifact_type', 'text');
    if (artifactsError || !artifacts || artifacts.length === 0) {
        console.log(`⚠️  No text artifacts found for job ${jobId}`);
        return;
    }
    console.log(`📚 Found ${artifacts.length} text artifacts`);
    // Organize readings by person and system
    const person1Readings = {};
    const person2Readings = {};
    for (const artifact of artifacts) {
        const meta = artifact.metadata || {};
        const docType = meta.docType;
        const system = meta.system;
        if (!system)
            continue; // Skip verdict for now
        // Download text content
        let text = '';
        if (artifact.storage_path) {
            const { data: downloadData, error: downloadError } = await supabaseClient_1.supabase.storage
                .from('job-artifacts')
                .download(artifact.storage_path);
            if (!downloadError && downloadData) {
                text = await downloadData.text();
            }
        }
        if (!text)
            continue;
        // Categorize by person
        if (docType === 'person1' || docType === 'individual') {
            person1Readings[system] = text;
        }
        else if (docType === 'person2') {
            person2Readings[system] = text;
        }
    }
    // Extract essences for person1
    if (Object.keys(person1Readings).length > 0) {
        console.log(`\n👤 Extracting essences for Person 1 (${person1Id})...`);
        const essences = (0, essenceExtractionService_1.extractAllEssences)(person1Readings);
        console.log(`   Found:`, JSON.stringify(essences, null, 2));
        if (Object.keys(essences).length > 0) {
            const { error: updateError } = await supabaseClient_1.supabase
                .from('people')
                .update({ essences })
                .eq('id', person1Id);
            if (updateError) {
                console.error(`   ❌ Failed to save essences:`, updateError);
            }
            else {
                console.log(`   ✅ Essences saved to database`);
            }
        }
    }
    // Extract essences for person2 (if overlay reading)
    if (person2Id && Object.keys(person2Readings).length > 0) {
        console.log(`\n👤 Extracting essences for Person 2 (${person2Id})...`);
        const essences = (0, essenceExtractionService_1.extractAllEssences)(person2Readings);
        console.log(`   Found:`, JSON.stringify(essences, null, 2));
        if (Object.keys(essences).length > 0) {
            const { error: updateError } = await supabaseClient_1.supabase
                .from('people')
                .update({ essences })
                .eq('id', person2Id);
            if (updateError) {
                console.error(`   ❌ Failed to save essences:`, updateError);
            }
            else {
                console.log(`   ✅ Essences saved to database`);
            }
        }
    }
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === '--help') {
        console.log(`
Usage:
  npx tsx src/scripts/extractAndSaveEssences.ts <jobId>     Extract essences for one job
  npx tsx src/scripts/extractAndSaveEssences.ts --all       Extract for all completed jobs
  npx tsx src/scripts/extractAndSaveEssences.ts --recent N  Extract for N most recent jobs
    `);
        process.exit(0);
    }
    try {
        if (args[0] === '--all') {
            console.log('📊 Extracting essences for ALL completed jobs...\n');
            const { data: jobs, error } = await supabaseClient_1.supabase
                .from('jobs')
                .select('id')
                .eq('status', 'completed')
                .order('created_at', { ascending: false });
            if (error || !jobs) {
                throw new Error(`Failed to fetch jobs: ${error?.message}`);
            }
            console.log(`Found ${jobs.length} completed jobs\n`);
            for (const job of jobs) {
                await extractEssencesForJob(job.id);
            }
        }
        else if (args[0] === '--recent') {
            const count = parseInt(args[1], 10) || 10;
            console.log(`📊 Extracting essences for ${count} most recent completed jobs...\n`);
            const { data: jobs, error } = await supabaseClient_1.supabase
                .from('jobs')
                .select('id')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(count);
            if (error || !jobs) {
                throw new Error(`Failed to fetch jobs: ${error?.message}`);
            }
            console.log(`Found ${jobs.length} jobs\n`);
            for (const job of jobs) {
                await extractEssencesForJob(job.id);
            }
        }
        else {
            // Single job ID
            const jobId = args[0];
            await extractEssencesForJob(jobId);
        }
        console.log(`\n✅ Essence extraction complete!`);
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=extractAndSaveEssences.js.map