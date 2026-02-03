````markdown
# Migration Plan — Supabase Queue V2

Purpose: safe, zero-downtime rollout of the Supabase-based job queue. Intended for engineers and on-call.

Prerequisites
- All DB migrations from `migrations/` applied to target environment
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` set in deployment secrets
- Monitoring in place (Sentry, Datadog) and access to Supabase SQL editor
- A rollback owner assigned (see Owners section)

High-level approach
- Week 0: Prepare and smoke-test in staging
- Week 1: Dual-write (writes to old + new systems) and smoke tests
- Week 2: Gradual read + 10% traffic to Queue V2
- Week 3: Increase rollout to 50% and closely monitor
- Week 4: Move to 100% read, decommission old readers
- Week 5: Cleanup and archive old artifacts

Verification queries
- Active jobs by status:
```sql
SELECT status, COUNT(*) FROM jobs GROUP BY status;
```
- Task backlog by type:
```sql
SELECT task_type, status, COUNT(*) FROM job_tasks GROUP BY task_type, status;
```
- Worker health:
```sql
SELECT worker_id, COUNT(*) AS active_tasks, MAX(last_heartbeat) AS last_seen
FROM job_tasks
WHERE status IN ('claimed','processing')
GROUP BY worker_id;
```

Rollout steps (detailed)

Week 0 — Staging
- Apply migrations to staging: `psql -f migrations/001_supabase_job_queue.sql`
- Deploy API + 1 worker in staging
- Run integration tests using `npm run test:integration`
- Owner: `backend-eng#alice`

Week 1 — Dual-write
- Deploy API change that writes to both old queue and Supabase queue. Keep reads using old system.
- Set `SUPABASE_QUEUE_ENABLED=false` in production secrets
- Run 100 manual jobs and verify parity of outcomes between systems.
- Owner: `backend-eng#bob`

Week 2 — Gradual read
- Set `SUPABASE_QUEUE_ENABLED=true` and `SUPABASE_QUEUE_ROLLOUT_PERCENT=10`
- Monitor for 24-48 hours. Watch failure rates, backlog, latencies.
- If errors increase > 2x baseline or backlog grows unexpectedly, rollback rollout percent to 0 and notify owners.
- Owner: `oncall#backend`

Week 3 — Increase to 50%
- Move rollout to 50% if metrics stable for 48 hours.
- Run end-to-end tests for audio/text workflows.
- Owner: `backend-eng#dev-lead`

Week 4 — Full cutover
- Move rollout to 100% and deprecate old readers.
- Monitor for 72 hours.
- Owner: `ops#release`

Backout / Rollback
- To quickly stop Supabase reads:
  - Set `SUPABASE_QUEUE_ENABLED=false` in production secrets
  - Scale workers down that only process new queue types
- To revert migrations (only if absolutely necessary):
  - Restore DB from pre-migration backup and re-run previously-working migration set
  - This is destructive; prefer feature-flag rollback

Post-migration cleanup
- Remove dual-write code and feature flags once stable for 2 weeks
- Archive old JSON job storage to `archive/jobs-YYYYMMDD/`

Owners
- Migration owner: `backend-eng#alice`
- Rollback lead: `ops#release`
- On-call: `oncall#backend`

Notes
- Rotate `SUPABASE_SERVICE_ROLE_KEY` if any key appears in repo history (audit required).
- Ensure `migrations/021_add_timeouts_and_retries.sql` is applied before heavy rollout.

````
