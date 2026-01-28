# RunPod Endpoint Fix

## Problem
The RunPod endpoint ID `90dt1bkdj3y08r` stored in Supabase does not exist. All audio generation tasks are failing with 404 errors.

## Root Cause
The endpoint was deleted or deactivated in RunPod. The endpoint ID needs to be updated.

## Solution

### Step 1: Get Your New Endpoint ID

1. Go to your RunPod console: https://www.runpod.io/console/serverless
2. Find your Chatterbox TTS endpoint (or create a new one if needed)
3. Copy the endpoint ID

### Step 2: Update the Endpoint ID

Run this script:
```bash
cd 1-in-a-billion-backend
npx tsx update_runpod_endpoint.ts
```

Enter your new endpoint ID when prompted.

**OR** update manually in Supabase:
```sql
UPDATE api_keys 
SET token = 'YOUR_NEW_ENDPOINT_ID',
    updated_at = NOW()
WHERE service = 'runpod_endpoint';
```

### Step 3: Verify

Test the endpoint:
```bash
npx tsx test_runpod_endpoint.ts
```

If it works, audio generation will automatically start working for new jobs.

## Current Status
- ❌ Endpoint ID `90dt1bkdj3y08r` - DOES NOT EXIST
- ❌ Old endpoint ID `tyj2436ozcz419` - DOES NOT EXIST
- ✅ Supabase keys are loading correctly
- ✅ Storage files exist and download successfully
- ✅ Audio worker is running on Fly.io

Once you update the endpoint ID, everything should work.
