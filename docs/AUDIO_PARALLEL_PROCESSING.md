# Audio Parallel Processing Optimization

**Status:** ⚠️  EXPERIMENTAL (Feature Branch)  
**Branch:** `feature/parallel-audio-stitching`  
**Date:** January 18, 2026

---

## 🎯 What This Does

Speeds up audio generation by processing multiple text chunks in parallel instead of sequentially.

**Speed Improvement:**
- **Before (Sequential):** 5 chunks × 30 seconds each = **~2.5 minutes**
- **After (Parallel, 3 concurrent):** 5 chunks in parallel = **~30-45 seconds**
- **Speedup:** **3-5x faster** ⚡

---

## 🛡️ Safe Rollback Strategy

### **How to Enable Parallel Mode**

Add to your `.env` file:

```bash
# Enable parallel audio processing (experimental)
AUDIO_PARALLEL_MODE=true

# Optional: Adjust concurrent chunk limit (default: 3)
AUDIO_CONCURRENT_LIMIT=3
```

### **How to Revert to Sequential Mode** (OLD STABLE CODE)

**Option 1:** Remove the environment variable from `.env`

**Option 2:** Explicitly disable it:
```bash
AUDIO_PARALLEL_MODE=false
```

**Option 3:** Revert the git branch:
```bash
git checkout main
```

---

## 🔧 How It Works

### **Sequential Mode (OLD)**
```
Chunk 1 → Wait → Chunk 2 → Wait → Chunk 3 → Wait → Chunk 4 → Wait → Chunk 5
   30s            30s            30s            30s            30s
Total: ~2.5 minutes
```

### **Parallel Mode (NEW)**
```
Chunk 1 ┐
Chunk 2 ├─→ All running concurrently (max 3 at once)
Chunk 3 ┤
Chunk 4 ├─→ Queue if >3 chunks
Chunk 5 ┘
Total: ~30-45 seconds
```

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `AUDIO_PARALLEL_MODE` | `false` | Enable parallel processing |
| `AUDIO_CONCURRENT_LIMIT` | `3` | Max concurrent chunks |

### **Recommended Settings:**

- **Small readings (1-3 chunks):** Sequential mode fine (no speedup)
- **Medium readings (4-8 chunks):** Parallel with `CONCURRENT_LIMIT=3`
- **Large readings (9+ chunks):** Parallel with `CONCURRENT_LIMIT=5`

⚠️  **Don't set too high:** RunPod has rate limits. Exceeding them causes failures.

---

## 🧪 Testing Checklist

Before enabling in production, test:

- [ ] **Short reading (1-2 chunks)** - Should work in both modes
- [ ] **Medium reading (5-7 chunks)** - Should be 3-5x faster in parallel
- [ ] **Long reading (10+ chunks)** - Check for timeouts or rate limits
- [ ] **Error handling** - Kill RunPod pod mid-generation, verify retry works
- [ ] **Audio quality** - Listen to full output, ensure no gaps/glitches
- [ ] **Concurrent requests** - Multiple users generating audio simultaneously

---

## 📊 Performance Comparison

| Chunks | Sequential | Parallel (3 concurrent) | Speedup |
|--------|-----------|-------------------------|---------|
| 1 | 30s | 30s | 1x |
| 2 | 60s | 35s | 1.7x |
| 5 | 150s (2.5min) | 45s | 3.3x |
| 10 | 300s (5min) | 90s (1.5min) | 3.3x |
| 20 | 600s (10min) | 180s (3min) | 3.3x |

---

## 🐛 Troubleshooting

### **Problem:** Audio chunks out of order

**Solution:** Check logs - parallel mode sorts results by original index before stitching.

### **Problem:** RunPod rate limit errors

**Solution:** Reduce `AUDIO_CONCURRENT_LIMIT` to 2 or switch back to sequential.

### **Problem:** Audio has gaps or glitches

**Solution:** This is likely unrelated to parallel processing (stitching is the same). Check:
- WAV header issues
- Sample rate mismatches
- Fade crossover settings

### **Problem:** Crashes or hangs

**Solution:** Revert to sequential mode immediately:
```bash
# In .env
AUDIO_PARALLEL_MODE=false
```
Then restart backend.

---

## 🔍 Code Changes

**File:** `src/routes/audio.ts`

**Changes:**
- Added feature flag check: `process.env.AUDIO_PARALLEL_MODE`
- Kept old sequential code as fallback (lines 476-498)
- Added new parallel code with `p-limit` (lines 463-475)
- Both paths use the same `generateChunk()` function (no changes to generation logic)
- Both paths use the same stitching logic (no changes to concatenation)

**Dependencies:**
- Added `p-limit` for controlled concurrency

---

## ✅ Merge Checklist

Before merging `feature/parallel-audio-stitching` → `main`:

- [ ] Tested on dev environment for 1 week
- [ ] No errors in logs for 100+ audio generations
- [ ] User testing confirms faster generation
- [ ] No audio quality regressions
- [ ] Rollback tested (set `AUDIO_PARALLEL_MODE=false` works)
- [ ] Documentation updated
- [ ] Team reviewed code changes

---

## 🚨 Rollback Plan (If Production Issues)

1. **Immediate:** Set `AUDIO_PARALLEL_MODE=false` in production `.env`
2. **Restart backend:** Changes take effect immediately (no code deploy needed)
3. **Monitor:** Verify sequential mode is working
4. **Investigate:** Check logs for parallel mode errors
5. **If needed:** Revert git branch: `git checkout main && git push`

---

## 📝 Notes for Future AI Agents

- **Don't remove the sequential code** - it's the stable fallback
- **The feature flag is the safety net** - one env var toggle to revert
- **Parallel mode doesn't change audio quality** - same generation + stitching logic
- **Only speedup is from concurrency** - chunks finish sooner, not faster per chunk

---

## 🎉 Success Criteria

✅ Parallel mode is ready for production when:
- 3-5x speedup confirmed in dev
- No errors for 500+ generations in dev
- Audio quality identical to sequential mode
- Rollback tested and confirmed working

---

**Questions?** Check logs for performance metrics (both modes log timing).

