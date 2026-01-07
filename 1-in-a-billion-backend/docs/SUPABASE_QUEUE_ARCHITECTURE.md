# Supabase Distributed Job Queue - Architecture

## 🎯 Design Goals

Scale from **1 → 1,000,000 clients** without rewriting by using:
- ✅ Supabase Postgres for queue/state (ACID + RLS)
- ✅ Supabase Storage for artifacts (MP3/PDF/JSON)
- ✅ Stateless workers on RunPod (horizontal scale)
- ✅ **Zero base64 blobs in database** (all artifacts in Storage)

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT APP                               │
│  POST /api/jobs/start → GET /api/jobs/:id (polling)            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Hono)                            │
│  - Creates job + tasks in Supabase                               │
│  - Streams progress from Supabase (single source of truth)       │
│  - Serves signed URLs for artifacts (MP3/PDF)                    │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE POSTGRES                              │
│                                                                   │
│  ┌────────┐    ┌────────────┐    ┌────────────────┐            │
│  │  jobs  │───▶│ job_tasks  │───▶│ job_artifacts  │            │
│  └────────┘    └────────────┘    └────────────────┘            │
│     │               │                    │                       │
│     │               │                    │                       │
│  [User RLS]    [Worker claim]    [Storage refs]                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STATELESS WORKERS (RunPod)                      │
│                                                                   │
│  Worker 1: claim_tasks() → process → upload → complete_task()  │
│  Worker 2: claim_tasks() → process → upload → complete_task()  │
│  Worker N: claim_tasks() → process → upload → complete_task()  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE STORAGE                               │
│                                                                   │
│  job-artifacts/                                                  │
│    {user_id}/{job_id}/audio/chapter1.mp3                        │
│    {user_id}/{job_id}/audio/chapter2.mp3                        │
│    {user_id}/{job_id}/pdf/chapter1.pdf                          │
│    {user_id}/{job_id}/json/chapter1.json                        │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Job Lifecycle

### 1. Job Creation (API → Supabase)

```typescript
POST /api/jobs/start
{
  "type": "nuclear_v2",
  "params": {
    "person1": {...},
    "person2": {...},
    "systems": ["vedic", "western", "human_design"]
  }
}

→ Supabase:
  - INSERT INTO jobs (user_id, type, params, status='queued')
  - INSERT INTO job_tasks (job_id, task_type, sequence, input)
    * Task 0: text_generation (Portraits)
    * Task 1: pdf_generation (Portraits)
    * Task 2: audio_generation (Portraits)
    * Task 3: text_generation (Hunger)
    * Task 4: pdf_generation (Hunger)
    * ... (16 documents total for Nuclear V2)
```

### 2. Worker Claims Task

```sql
-- Worker polls every 5-30 seconds (exponential backoff)
SELECT * FROM claim_tasks('worker-abc-123', 5, ARRAY['text_generation']);

→ Returns up to 5 unclaimed tasks (FOR UPDATE SKIP LOCKED)
→ Sets status='claimed', worker_id='worker-abc-123', claimed_at=now()
```

### 3. Worker Processes Task

```typescript
// Pseudo-code
for (const task of claimedTasks) {
  await heartbeat(task.id, workerId); // Every 30-60s
  
  const result = await processTask(task);
  
  // Upload artifacts to Storage
  const artifactPath = `${userId}/${jobId}/audio/chapter1.mp3`;
  await supabase.storage.upload('job-artifacts', artifactPath, mp3Buffer);
  
  // Create artifact record
  await supabase.from('job_artifacts').insert({
    job_id: jobId,
    task_id: task.id,
    artifact_type: 'audio_mp3',
    storage_path: artifactPath,
    public_url: signedUrl,
    file_size_bytes: mp3Buffer.length,
    duration_seconds: 180
  });
  
  // Mark task complete
  await completeTask(task.id, workerId, { success: true });
}
```

### 4. Progress Computation

Progress is auto-computed by triggers:

```sql
-- Trigger: auto_update_job_status_on_task_change
-- Counts: pending, complete, failed tasks
-- Updates: job.status, job.progress.percent, job.progress.phase

Progress phases:
- queued       → 0%
- calculating  → 5%  (birth chart computed)
- text         → 10-50% (16 documents × text generation)
- pdf          → 50-70% (16 documents × PDF)
- audio        → 70-95% (16 documents × TTS)
- finalizing   → 95-99% (cleanup, metadata)
- complete     → 100%
```

### 5. Client Polls Status

```typescript
GET /api/jobs/:id
→ Fetches from Supabase (single source of truth)
→ Returns:
{
  "id": "...",
  "status": "processing",
  "progress": {
    "percent": 45,
    "phase": "text",
    "docsComplete": 7,
    "docsTotal": 16,
    "message": "Generating chapter: Hunger..."
  },
  "artifacts": [
    {
      "type": "audio_mp3",
      "url": "https://supabase.co/storage/.../chapter1.mp3",
      "duration": 180
    }
  ]
}
```

## 🛡️ Concurrency & Idempotency

### Task Claiming (Distributed Lock)

```sql
-- FOR UPDATE SKIP LOCKED prevents:
-- 1. Two workers claiming the same task
-- 2. Lock contention (worker B doesn't wait for worker A)

SELECT * FROM job_tasks
WHERE status = 'pending'
ORDER BY sequence ASC
LIMIT 5
FOR UPDATE SKIP LOCKED;  ← Magic sauce
```

### Idempotency Rules

1. **Task IDs are UUIDs** → deterministic retry
2. **Artifacts use unique paths** → `{userId}/{jobId}/audio/{taskId}.mp3`
3. **Storage uploads are idempotent** → same path = overwrite
4. **Task completion is atomic** → `status = 'complete'` only if `worker_id = self`

### Retry Logic

```typescript
// Worker-side retry (transient failures)
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await processTask(task);
    await completeTask(task.id, workerId);
    break;
  } catch (error) {
    if (attempt === 3) {
      await failTask(task.id, workerId, error.message);
    } else {
      await sleep(attempt * 5000); // Exponential backoff
    }
  }
}

// Database-side retry (task.attempts < max_attempts)
// fail_task() sets status='pending' if attempts < 3
// Another worker will pick it up
```

## 🔐 Security (RLS Policies)

### Users

- ✅ Can view their own jobs
- ✅ Can create jobs under their user_id
- ❌ Cannot see other users' jobs
- ❌ Cannot claim/update tasks directly

### Workers (Service Role)

- ✅ Can claim tasks from any job
- ✅ Can update task status/heartbeat
- ✅ Can create artifacts
- ✅ Cannot see job.params for other users (unless explicitly granted)

### RLS Example

```sql
-- Users can only see their own jobs
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Workers (service role) bypass RLS
CREATE POLICY "Service role can do everything on tasks"
  ON job_tasks FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

## 📊 Storage Strategy

### Artifact Types & Formats

| Type | Primary | Fallback | Never Store |
|------|---------|----------|-------------|
| Audio | MP3 (128kbps) | M4A | ❌ WAV (too large) |
| PDF | PDF/A | - | ❌ Base64 in DB |
| Text | JSON | - | ❌ Inline in tasks |

### Storage Path Structure

```
job-artifacts/
  {user_id}/
    {job_id}/
      audio/
        chapter1.mp3         (primary)
        chapter1.m4a         (fallback, optional)
        chapter2.mp3
        ...
      pdf/
        chapter1.pdf
        chapter2.pdf
        full_nuclear.pdf
      json/
        chapter1_metadata.json
        full_nuclear.json
```

### Signed URLs (Temporary Access)

```typescript
// Generate 1-hour signed URL
const { data, error } = await supabase.storage
  .from('job-artifacts')
  .createSignedUrl(`${userId}/${jobId}/audio/chapter1.mp3`, 3600);

// Store in job_artifacts.public_url
// Client can stream audio without auth for 1 hour
```

## 🔄 Worker Architecture

### Worker Types

1. **Text Generation Worker**
   - Claims `text_generation` tasks
   - Calls Claude API
   - Stores result in task.output
   - No artifacts (text stored inline for next task)

2. **PDF Generation Worker**
   - Claims `pdf_generation` tasks
   - Reads text from previous task.output
   - Generates PDF with PDFKit
   - Uploads to Storage → creates artifact

3. **Audio Generation Worker**
   - Claims `audio_generation` tasks
   - Reads text from previous task.output
   - Calls Chatterbox TTS (RunPod)
   - Uploads MP3 to Storage → creates artifact

### Worker Polling Loop

```typescript
class Worker {
  private workerId = `worker-${os.hostname()}-${process.pid}`;
  private backoff = 5000; // Start at 5s
  
  async start() {
    while (true) {
      try {
        const tasks = await this.claimTasks(5);
        
        if (tasks.length === 0) {
          // Exponential backoff (5s → 10s → 20s → 30s max)
          this.backoff = Math.min(this.backoff * 2, 30000);
          await sleep(this.backoff);
          continue;
        }
        
        // Reset backoff on work
        this.backoff = 5000;
        
        // Process tasks in parallel (up to 5 concurrent)
        await Promise.all(tasks.map(task => this.processTask(task)));
        
      } catch (error) {
        console.error('Worker error:', error);
        await sleep(10000); // Cool down on error
      }
    }
  }
  
  private async claimTasks(maxTasks: number) {
    const { data, error } = await supabase.rpc('claim_tasks', {
      p_worker_id: this.workerId,
      p_max_tasks: maxTasks,
      p_task_types: ['text_generation', 'audio_generation']
    });
    
    return data || [];
  }
  
  private async processTask(task) {
    // Start heartbeat (every 60s)
    const heartbeatInterval = setInterval(async () => {
      await supabase.rpc('heartbeat_task', {
        p_task_id: task.id,
        p_worker_id: this.workerId
      });
    }, 60000);
    
    try {
      // Process task (with retries)
      const result = await this.executeTask(task);
      
      // Upload artifacts if needed
      if (result.artifacts) {
        for (const artifact of result.artifacts) {
          await this.uploadArtifact(artifact);
        }
      }
      
      // Mark complete
      await supabase.rpc('complete_task', {
        p_task_id: task.id,
        p_worker_id: this.workerId,
        p_output: result.output
      });
      
    } catch (error) {
      await supabase.rpc('fail_task', {
        p_task_id: task.id,
        p_worker_id: this.workerId,
        p_error: error.message
      });
    } finally {
      clearInterval(heartbeatInterval);
    }
  }
}
```

### Stale Task Watchdog (Cron)

```typescript
// Run every 5 minutes via pg_cron or external scheduler
SELECT cron.schedule('reclaim-stale-tasks', '*/5 * * * *', $$
  SELECT reclaim_stale_tasks();
$$);

// Or in Node.js worker:
setInterval(async () => {
  const { data } = await supabase.rpc('reclaim_stale_tasks');
  if (data > 0) {
    console.log(`Reclaimed ${data} stale tasks`);
  }
}, 5 * 60 * 1000);
```

## 📈 Scaling Strategy

### Horizontal Scaling

| Load | Workers | Cost | Response Time |
|------|---------|------|---------------|
| 1-10 jobs/min | 1 worker | $7/day | ~5 min |
| 10-100 jobs/min | 5 workers | $35/day | ~2 min |
| 100-1000 jobs/min | 20 workers | $140/day | ~1 min |
| 1000+ jobs/min | 50+ workers | $350+/day | <1 min |

### Auto-Scaling (Future)

```typescript
// Monitor queue depth
const pendingTasks = await supabase
  .from('job_tasks')
  .select('count')
  .eq('status', 'pending');

if (pendingTasks.count > 100) {
  // Spin up more RunPod workers
  await runpod.scaleEndpoint(endpointId, { minWorkers: 5 });
}
```

## 🎯 Migration Strategy

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for step-by-step cutover plan.

## 📚 References

- [SQL Migration](../migrations/001_supabase_job_queue.sql)
- [API Contract](./API_CONTRACT.md)
- [Migration Plan](./MIGRATION_PLAN.md)


