# Supabase Queue Setup for Auto-Scaling

## Quick Setup (5 minutes)

### 1. Get Supabase Keys

Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/settings/api

Copy these values:
- **Project URL** → `SUPABASE_URL`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secret!)
- **anon public key** → `SUPABASE_ANON_KEY`

### 2. Add to Backend .env

```bash
cd /Users/michaelperinwogenburg/Desktop/1-in-a-billion-app/1-in-a-billion-backend
```

Add to `.env`:
```env
SUPABASE_URL=https://qdfikbgwuauertfmkmzk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your key)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (your key)
RUNPOD_WORKER_ENDPOINT_ID=your-endpoint-id (optional, for auto-scaling)
```

### 3. Run SQL Migration

Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new

Copy entire contents of: `migrations/001_supabase_job_queue.sql`

Paste and click "Run"

### 4. Create Storage Bucket

Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/storage/buckets

Click "New bucket":
- Name: `job-artifacts`
- Public: **NO** (Private)
- File size limit: 100 MB
- Allowed MIME types: `audio/*,application/pdf,application/json,text/*`

### 5. Test

Restart backend:
```bash
npm run dev
```

Test job creation:
```bash
curl -X POST http://localhost:8787/api/jobs/v2/start \
  -H "Content-Type: application/json" \
  -d '{
    "type": "nuclear_v2",
    "person1": {
      "name": "Test",
      "birthDate": "2000-01-01",
      "birthTime": "12:00",
      "timezone": "UTC",
      "latitude": 0,
      "longitude": 0
    },
    "person2": {
      "name": "Test2",
      "birthDate": "2000-01-01",
      "birthTime": "12:00",
      "timezone": "UTC",
      "latitude": 0,
      "longitude": 0
    }
  }'
```

### 6. Auto-Scaling

Once configured, the auto-scaler will:
- Monitor queue depth every 30 seconds
- Scale RunPod workers: 0-50 based on pending tasks
- Automatically start when backend runs in production mode

## Verification

Check queue stats:
```bash
curl http://localhost:8787/api/dev/stats
```

Should show:
```json
{
  "supabase": {
    "pending": <number>,
    "processing": <number>,
    ...
  }
}
```






