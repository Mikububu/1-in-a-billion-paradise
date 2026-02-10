import 'dotenv/config';
import { createSupabaseServiceClient } from '../services/supabaseClient';

/**
 * Verifies that the DB trigger `auto_create_job_tasks()` creates the correct
 * task fan-out for synastry and nuclear_v2 jobs.
 *
 * This script creates temporary jobs, inspects created job_tasks, then deletes the jobs.
 *
 * Usage:
 *   npx ts-node src/scripts/verifySynastryTaskFanout.ts
 *   KEEP=1 npx ts-node src/scripts/verifySynastryTaskFanout.ts  (skip cleanup)
 */
async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error('Supabase service client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');

  const keep = String(process.env.KEEP || '') === '1';
  const now = new Date().toISOString();

  // Use a real user_id so the jobs.user_id FK (auth.users) is satisfied.
  // Allow override via TEST_USER_ID if needed.
  let testUserId = String(process.env.TEST_USER_ID || '').trim();
  if (!testUserId) {
    const { data, error } = await supabase
      .from('library_people')
      .select('user_id')
      .eq('is_user', true)
      .limit(1)
      .single();
    if (error || !data?.user_id) {
      throw new Error(`Could not resolve a test user_id from library_people (is_user=true). ${error?.message || ''}`);
    }
    testUserId = String(data.user_id);
  }

  const mkPerson = (name: string) => ({
    id: `test-${name.toLowerCase()}-${Date.now()}`,
    name,
    birthDate: '1990-01-01',
    birthTime: '12:00',
    timezone: 'UTC',
    latitude: 0,
    longitude: 0,
  });

  async function createJob(type: 'synastry' | 'nuclear_v2', systems: string[]) {
    const params: any = {
      type,
      systems,
      style: 'production',
      relationshipIntensity: 5,
      person1: mkPerson('P1'),
      person2: mkPerson('P2'),
      relationshipContext: `TEST (${now})`,
    };

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        user_id: testUserId,
        type,
        params,
        status: 'queued',
        progress: { percent: 0, phase: 'queued', message: 'test' },
        attempts: 0,
        max_attempts: 3,
      })
      .select('id')
      .single();

    if (error || !job?.id) throw new Error(`Failed to create job: ${error?.message || 'unknown'}`);
    return job.id as string;
  }

  async function fetchTextTasks(jobId: string) {
    const { data, error } = await supabase
      .from('job_tasks')
      .select('id, task_type, sequence, input')
      .eq('job_id', jobId)
      .eq('task_type', 'text_generation')
      .order('sequence', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((t: any) => ({
      id: t.id,
      seq: t.sequence,
      docNum: t.input?.docNum,
      docType: t.input?.docType,
      system: t.input?.system ?? null,
      title: t.input?.title ?? null,
    }));
  }

  async function cleanup(jobId: string) {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) throw new Error(`Cleanup failed for ${jobId}: ${error.message}`);
  }

  const results: any = { ok: true, ts: now, checks: [] as any[] };

  // 1) Synastry: 1 system → 3 docs (p1, p2, overlay), NO verdict
  const synJobId = await createJob('synastry', ['vedic']);
  const synTasks = await fetchTextTasks(synJobId);
  results.checks.push({
    name: 'synastry:vedic fanout',
    jobId: synJobId,
    expected: { taskCount: 3, docTypes: ['person1', 'person2', 'overlay'], noVerdict: true },
    actual: {
      taskCount: synTasks.length,
      docTypes: synTasks.map((t: any) => t.docType),
      hasVerdict: synTasks.some((t: any) => t.docType === 'verdict'),
      tasks: synTasks,
    },
    pass:
      synTasks.length === 3 &&
      synTasks.map((t: any) => t.docType).join(',') === 'person1,person2,overlay' &&
      synTasks.every((t: any) => String(t.system).toLowerCase() === 'vedic'),
  });
  if (!keep) await cleanup(synJobId);

  // 2) Nuclear v2: 5 systems → 16 docs; doc 16 is verdict
  const nucJobId = await createJob('nuclear_v2', ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah']);
  const nucTasks = await fetchTextTasks(nucJobId);
  const verdictTask = nucTasks.find((t: any) => t.docNum === 16);
  results.checks.push({
    name: 'nuclear_v2 fanout',
    jobId: nucJobId,
    expected: { taskCount: 16, verdictDocNum: 16, verdictDocType: 'verdict' },
    actual: {
      taskCount: nucTasks.length,
      docNums: nucTasks.map((t: any) => t.docNum),
      verdict: verdictTask || null,
      first3: nucTasks.slice(0, 3),
      last3: nucTasks.slice(-3),
    },
    pass: nucTasks.length === 16 && verdictTask?.docType === 'verdict',
  });
  if (!keep) await cleanup(nucJobId);

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }));
  process.exit(1);
});

