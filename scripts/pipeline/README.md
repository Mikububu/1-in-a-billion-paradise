# V2 Pipeline Scripts

These scripts live in the V2 project so we can delete `ONEINABILLIONAPP/` without losing operational tooling.

They are designed to test the full backend pipeline in the exact order we agreed:

1. single (one-system) job
2. synastry job
3. one 16-doc bundle job (`nuclear_v2` in the backend API contract)

All runs:
- seed `library_people` rows first (self + partner IDs)
- run image transform first (two portraits + couple image)
- then start the job and poll until complete
- then download PDFs and do a basic “contains embedded images” sanity check

## Setup

Create a local env file (gitignored) at:

- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/.env.local`

Minimum variables:

```bash
CORE_API_URL=https://1-in-a-billion-backend.fly.dev
USER_ID=f23f2057-5a74-4fc7-ab39-2a1f17729c2c

# Needed only for the seed step (upserting library_people):
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run

```bash
cd /Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2
node scripts/pipeline/run-e2e.mjs \
  --p1-image /absolute/path/to/person1.jpg \
  --p2-image /absolute/path/to/person2.jpg
```

Outputs:
- downloads PDFs into `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/_pipeline_out/<jobId>/`

