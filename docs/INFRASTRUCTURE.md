# 1 in a Billion - Infrastructure Setup (Dec 24, 2025)

## Text Worker Deployment

### Primary: Fly.io (FREE)
- **URL:** https://1-in-a-billion-backend.fly.dev
- **Region:** Singapore (SIN)
- **Config:** `fly.toml` with `min_machines_running = 1`
- **Does NOT sleep** - runs 24/7
- **Worker ID pattern:** `worker-48e2599b1505d8-XXX`

### Backup: Render (FREE tier)
- **URL:** https://1-in-a-billion-backend.onrender.com
- **Sleeps after 15 min inactivity** but wakes on HTTP request
- **Worker ID pattern:** `worker-srv-*-hibernate-*`
- Both can run in parallel - no conflict

## Supabase Job Queue
- **URL:** https://qdfikbgwuauertfmkmzk.supabase.co
- Tables: `jobs`, `job_tasks`, `job_artifacts`
- Workers claim tasks via `claim_tasks` RPC function
- Heartbeat prevents stuck tasks

## Environment Secrets (on Fly.io)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- DEEPSEEK_API_KEY
- LLM_PROVIDER=deepseek
- SUPABASE_QUEUE_ENABLED=true

## Deploy Commands
```bash
# Fly.io
flyctl deploy --remote-only

# Or from dashboard: https://fly.io/apps/1-in-a-billion-backend
```

## Monitor Tasks
```bash
curl -s "https://qdfikbgwuauertfmkmzk.supabase.co/rest/v1/job_tasks?select=status" \
  -H "apikey: YOUR_ANON_KEY" | jq 'group_by(.status)'
```
