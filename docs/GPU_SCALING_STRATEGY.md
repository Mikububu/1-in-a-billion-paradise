# GPU Scaling Strategy

## Step 1: Start With One Small Persistent GPU

For testing:

• GPU: RTX A4000 or RTX 3090
• Cost: relatively low
• Run 1 worker only
• Concurrency: exactly 1 audiobook chapter at a time

This gives you:
• near minimum monthly spend
• zero cold starts
• stable debugging environment

You will not scale yet. You just validate:
• audio quality
• job lifecycle
• end-to-end flow
• billing logic

⸻

## Step 2: Add Queue-Driven Autoscaling

This is the crucial part.

You do not autoscale based on HTTP traffic.
You autoscale based on queue depth.

### Autoscaling rule example

• If queue length > 10 chapters → add 1 GPU pod
• If queue length > 50 chapters → add 5 GPU pods
• If queue empty for 10 minutes → scale back down

This can be implemented in:
• a small control service
• or a cron-like scheduler
• or Fly.io scaling API

The worker pods are stateless so scaling is safe.

⸻

## Step 3: Cap Max Spend (Very Important)

You define a hard upper limit:

• Max GPU pods = N
• Max cost per hour = X USD

Even if 10,000 users click "generate audiobook", you:
• queue jobs
• process in order
• never exceed your budget

This protects you from viral spikes or malicious abuse.

⸻

## Step 4: Use Serverless Only as UX Sugar

Serverless is not your core engine.

Use it only for:
• preview clips
• first 30 seconds
• short free readings

Never for:
• audiobooks
• long chapters
• paid batch generation

This keeps perceived performance high while protecting the backend.

⸻

## Cost Behavior Over Time

### During testing

• 1 GPU pod
• Cost is flat and predictable
• Maybe idle some hours but cheap

### During growth

• Queue fills
• Autoscaler spins up more pods
• Revenue scales before cost explodes

### During lull

• Queue drains
• Pods shut down
• Cost drops automatically

This is exactly what you want.

---

## Implementation Status

✅ **Step 1:** Implemented - Workers run on Fly.io
✅ **Step 2:** Implemented - Queue-based scaling via Supabase job queue
✅ **Step 3:** Implemented - Rate limits handled via Replicate API
✅ **Step 4:** Implemented - Audio via Replicate (Chatterbox Turbo), Songs via MiniMax

## Current Configuration

**Infrastructure:**
- **Text Workers:** Fly.io (horizontal scaling)
- **Audio/TTS:** Replicate API (Chatterbox Turbo) - rate-limited, sequential processing
- **Song Generation:** MiniMax Music 2.5 API

See `REPLICATE_RATE_LIMITS.md` for audio rate limit handling.


