"use strict";
/**
 * WATCH LATEST JOB - Poll and display status of the most recent job
 * Usage: npx tsx src/scripts/watch-latest-job.ts [interval_sec]
 * Default: poll every 20 seconds. Ctrl+C to stop.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
const POLL_INTERVAL_MS = Math.max(10, parseInt(process.argv[2] || '20', 10) * 1000);
async function runCheck() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, type, status, params, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1);
    if (jobsError || !jobs?.length) {
        console.log('⏳ No jobs found');
        return;
    }
    const job = jobs[0];
    const p1 = job.params?.person1?.name || '?';
    const p2 = job.params?.person2?.name;
    const label = p2 ? `${p1} + ${p2}` : p1;
    console.log('\n' + '─'.repeat(60));
    console.log(`📋 ${label} (${job.type}) | ${job.status}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log(`   Updated: ${new Date(job.updated_at).toLocaleString()}`);
    const { data: tasks, error: tasksError } = await supabase
        .from('job_tasks')
        .select('id, task_type, status, sequence, input, error, started_at, completed_at, last_heartbeat, worker_id, attempts, max_attempts')
        .eq('job_id', job.id)
        .order('sequence', { ascending: true });
    if (tasksError || !tasks?.length) {
        console.log('   ⚠️ No tasks yet');
        return;
    }
    const text = tasks.filter((t) => t.task_type === 'text_generation');
    const audio = tasks.filter((t) => t.task_type === 'audio_generation');
    const song = tasks.filter((t) => t.task_type === 'song_generation');
    const pdf = tasks.filter((t) => t.task_type === 'pdf_generation');
    const fmt = (arr) => `${arr.filter((t) => t.status === 'complete').length}/${arr.length} ✅`;
    console.log(`   📝 Text: ${fmt(text)} | 🎵 Audio: ${fmt(audio)} | 🎶 Song: ${fmt(song)} | 📄 PDF: ${fmt(pdf)}`);
    for (const t of audio.filter((x) => x.status !== 'complete')) {
        const sys = t.input?.system || '?';
        const doc = t.input?.docType || '?';
        const hb = t.last_heartbeat
            ? `${Math.floor((Date.now() - new Date(t.last_heartbeat).getTime()) / 1000)}s ago`
            : 'never';
        console.log(`      🎵 ${doc}/${sys} → ${t.status} (heartbeat: ${hb}) ${t.error ? `| ${t.error.slice(0, 60)}...` : ''}`);
    }
    for (const t of song.filter((x) => x.status !== 'complete')) {
        const sys = t.input?.system || '?';
        console.log(`      🎶 Song ${sys} → ${t.status} ${t.error ? `| ${t.error.slice(0, 60)}...` : ''}`);
    }
    console.log('─'.repeat(60) + '\n');
}
async function loop() {
    console.log(`\n👀 Watching latest job (every ${POLL_INTERVAL_MS / 1000}s). Ctrl+C to stop.\n`);
    for (;;) {
        await runCheck();
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
}
loop().catch((e) => {
    console.error('❌', e);
    process.exit(1);
});
//# sourceMappingURL=watch-latest-job.js.map