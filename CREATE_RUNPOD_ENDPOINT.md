# Create RunPod Chatterbox Endpoint - Step by Step

## What You Need
You need to create a RunPod serverless endpoint for Chatterbox TTS (Text-to-Speech). This is a one-time setup.

## Step 1: Go to RunPod Console

1. Open your browser
2. Go to: **https://www.runpod.io/console/serverless**
3. Log in if needed

## Step 2: Check if You Already Have an Endpoint

1. Look at the list of endpoints on the page
2. Look for any endpoint with a name like:
   - "Chatterbox"
   - "TTS" 
   - "Voice"
   - "Audio"
   - Or any endpoint you created before

**If you find one:**
- Click on it
- Look for the **Endpoint ID** (it's a long string like `abc123xyz456`)
- Copy that ID
- Skip to Step 4

**If you don't find one:**
- Continue to Step 3 to create a new one

## Step 3: Create New Endpoint (If Needed)

1. Click the **"+ New Endpoint"** or **"Create Endpoint"** button
2. Choose **"Import from Docker Registry"** or **"Import from Git Repository"**
3. For Chatterbox, you typically need:
   - **Docker Image:** Look for a Chatterbox TTS Docker image (check RunPod templates or community templates)
   - **Name:** Call it "Chatterbox TTS" or "TTS Endpoint"
   - **GPU:** Choose the cheapest GPU option (usually RTX 3090 or similar)
   - **Idle Timeout:** Set to 5-10 minutes (to save money)
4. Click **"Deploy"** or **"Create"**
5. Wait for it to deploy (may take a few minutes)
6. Once deployed, copy the **Endpoint ID** from the endpoint details page

## Step 4: Update the Endpoint ID

Once you have the endpoint ID, run this command:

```bash
cd "1-in-a-billion-backend"
npx tsx update_runpod_endpoint.ts
```

Paste the endpoint ID when prompted.

**OR** update it directly in Supabase:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Table Editor** → **api_keys**
4. Find the row where `service = 'runpod_endpoint'`
5. Click to edit
6. Update the `token` field with your new endpoint ID
7. Save

## Step 5: Test It

Run this to verify it works:
```bash
npx tsx test_runpod_endpoint.ts
```

If you see "✅ Request succeeded!", you're done! Audio generation will work automatically.

## Troubleshooting

**"I can't find the endpoint creation button"**
- Make sure you're on the Serverless page, not the Pods page
- The URL should be: https://www.runpod.io/console/serverless

**"I don't know which Docker image to use"**
- Search RunPod community templates for "Chatterbox" or "TTS"
- Or use a generic TTS Docker image that supports voice cloning

**"The endpoint ID is not working"**
- Make sure you copied the full ID (it's usually 12-15 characters)
- Check that the endpoint status is "Ready" or "Running"
- Try the test script to see the exact error

## Need Help?

If you're stuck, tell me:
1. What page you're on in RunPod
2. What buttons/options you see
3. Any error messages

I'll guide you through the exact steps.
