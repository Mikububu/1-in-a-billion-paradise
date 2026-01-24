# Replicate Chatterbox Turbo - Rate Limit Handling

## Problem
Replicate throttles accounts with < $5 credit to **6 requests/minute with burst 1**.

Audio generation with 30-50 chunks was hitting this limit immediately, causing failures.

## Solution (Jan 23, 2026)
Added intelligent rate limiting to `audioWorker.ts`:

### 1. **Sequential Mode (Default)**
- Processes chunks one-at-a-time with configurable delays
- Default: 11 second delay between chunks (~5.5 req/min, safely under 6 req/min)
- Environment variables:
  ```bash
  AUDIO_PARALLEL_MODE=false  # Default - sequential processing
  REPLICATE_CHUNK_DELAY_MS=11000  # Default - 11 second delay
  ```

### 2. **Smart Retry Logic**
- Parses `retry_after` from 429 responses
- Exponential backoff for failed chunks
- Up to 5 retries per chunk (increased from 3)

### 3. **Parallel Mode (Optional)**
- Only enable if you have sufficient Replicate credit
- Lower concurrency limit (default 2, was 5)
- Environment variables:
  ```bash
  AUDIO_PARALLEL_MODE=true
  AUDIO_CONCURRENT_LIMIT=2
  REPLICATE_CHUNK_DELAY_MS=11000
  ```

## Voice Types Supported
Both work with the same rate-limiting logic:
- **Turbo Presets**: Aaron, Abigail, Andy, Brian, Emmanuel, Evelyn, Gavin, Gordon, Ivan, Laura, Lucy, Walter
- **Custom Voice Clones**: David, Elisabeth, Michael, Peter, Victor (via `audio_url`)

## Expected Performance
- **30 chunks** = ~6 minutes (with 11s delay)
- **50 chunks** = ~10 minutes (with 11s delay)
- **Turbo**: Same timing (Replicate rate limit applies to both)

Slower than parallel, but **reliable** and won't fail with rate limits.

## Increasing Speed (If Needed)
1. **Add $5+ to Replicate account** → rate limit increases
2. **Then** reduce `REPLICATE_CHUNK_DELAY_MS` to 3000-5000ms
3. **Or** enable `AUDIO_PARALLEL_MODE=true` with `AUDIO_CONCURRENT_LIMIT=5`
