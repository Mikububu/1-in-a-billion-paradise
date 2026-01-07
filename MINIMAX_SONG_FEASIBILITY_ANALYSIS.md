# MiniMax Song Generation - Feasibility Analysis

## Executive Summary

**Status**: ⚠️ **UNCERTAIN - Requires API Documentation Verification**

MiniMax has recently introduced music/song generation capabilities, but **API access for full song generation with vocals is unclear** from publicly available information. This analysis provides a feasibility assessment and architecture recommendation.

## Feature Requirements

1. **Lyrics Generation**: DeepSeek LLM generates personalized lyrics from deep reading data
2. **Song Generation**: MiniMax API generates full song with vocals from lyrics
3. **Style**: 70% Leonard Cohen, 20% Paul Simon, 10% Tom Waits
   - Deep male voice
   - Dark, poetic, intimate tone
   - Minimal, emotionally intimate (not pop/commercial)
4. **Storage & Playback**: Store in user's reading library alongside audiobook and PDF

## Verification Points

### ❓ Critical Unknowns

1. **API Endpoint Availability**
   - Does MiniMax expose music generation via API?
   - Is it UI-only or programmatically accessible?
   - What is the endpoint URL and authentication method?

2. **Vocals Support**
   - Does API support full song generation with vocals?
   - Or only instrumental generation?
   - Can vocals be controlled separately?

3. **Lyrics Input**
   - Can lyrics be passed as structured text input?
   - What format is required?
   - Are there length limitations?

4. **Style Control**
   - Can voice style be controlled via API parameters?
   - Are style references (Cohen/Simon/Waits) supported?
   - Can tone/emotion be specified?
   - Is custom voice model training required?

5. **Audio Output**
   - What audio format is returned? (MP3, WAV, etc.)
   - What is the file size range?
   - What is the generation time?
   - Is it suitable for storage and playback?

## Recommended Verification Steps

### Step 1: Check MiniMax API Documentation
```bash
# Check official MiniMax API docs
# Look for:
# - Music generation endpoint
# - Song generation endpoint
# - Audio generation API
```

### Step 2: Test API Access
```typescript
// Test endpoint with sample request
const response = await fetch('https://api.minimax.ai/v1/music/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    lyrics: 'Sample lyrics here...',
    style: 'dark_poetic',
    voice: 'deep_male',
  }),
});
```

### Step 3: Contact MiniMax Support
- Request API documentation for music generation
- Ask about vocals support
- Inquire about style control capabilities
- Check if enterprise plan is required

## Architecture Recommendation

### If API Supports Full Song Generation ✅

#### Pipeline Flow

```
Deep Reading Job (nuclear_package/deep_soul)
    ↓
[Step 1] Generate Lyrics (DeepSeek LLM)
    ↓
[Step 2] Generate Song (MiniMax API)
    ↓
[Step 3] Store & Link (Supabase Storage)
    ↓
[Step 4] Display in Library UI
```

#### Implementation Structure

**1. Backend: Lyrics Generation Service**
```typescript
// src/services/lyricsGenerator.ts
export async function generatePersonalizedLyrics(
  readingData: DeepReadingData,
  userName: string
): Promise<string> {
  // Extract soul themes, emotions, fears, desires, life direction
  // Generate lyrics using DeepSeek with specific prompt
  // Must include user's name explicitly
  // Style: dark, poetic, intimate
}
```

**2. Backend: Song Generation Service**
```typescript
// src/services/songGenerator.ts
export async function generateSongFromLyrics(
  lyrics: string,
  styleParams: SongStyleParams
): Promise<Buffer> {
  // Call MiniMax API with:
  // - Lyrics text
  // - Style parameters (70% Cohen, 20% Simon, 10% Waits)
  // - Voice: deep male
  // - Tone: dark, poetic, intimate
  // Return audio buffer
}
```

**3. Backend: Song Worker**
```typescript
// src/workers/songWorker.ts
export async function processSongGeneration(
  jobId: string,
  taskId: string
) {
  // 1. Get deep reading data
  // 2. Generate lyrics (DeepSeek)
  // 3. Generate song (MiniMax)
  // 4. Upload to Supabase Storage
  // 5. Create job_artifacts record (type: 'song')
}
```

**4. Database Schema**
```sql
-- Add to existing job_artifacts table
ALTER TABLE job_artifacts 
ADD COLUMN IF NOT EXISTS artifact_type TEXT DEFAULT 'audio';

-- Song-specific metadata (optional)
CREATE TABLE IF NOT EXISTS song_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES job_artifacts(id) ON DELETE CASCADE,
  lyrics TEXT NOT NULL,
  style_params JSONB,
  duration_seconds INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**5. Frontend: Library Integration**
```typescript
// src/screens/home/MyLibraryScreen.tsx
// Add "Your Song" section alongside audiobook and PDF

<View style={styles.songSection}>
  <Text style={styles.sectionTitle}>Your Song</Text>
  <TouchableOpacity onPress={() => playSong(reading.songUrl)}>
    <Text>▶ Play Song</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => downloadSong(reading.songUrl)}>
    <Text>⬇ Download</Text>
  </TouchableOpacity>
</View>
```

### If API Does NOT Support Full Song Generation ❌

#### Alternative Options

**Option 1: Hybrid Approach**
- Generate instrumental via MiniMax API
- Generate vocals separately (TTS with style control)
- Combine using audio processing (FFmpeg)

**Option 2: TTS + Background Music**
- Generate lyrics (DeepSeek)
- Generate spoken/recited version (RunPod Chatterbox with style)
- Add instrumental background (MiniMax or other)
- Mix audio tracks

**Option 3: Wait for API Support**
- Monitor MiniMax API updates
- Implement lyrics generation now
- Add song generation when API becomes available

## Integration with Existing System

### Current Audio Infrastructure

Your system already has:
- ✅ Audio storage in Supabase Storage (`job-artifacts` bucket)
- ✅ Audio playback in library (`MyLibraryScreen.tsx`)
- ✅ Audio download functionality
- ✅ Job artifacts system (`job_artifacts` table)
- ✅ Deep reading generation pipeline (`nuclear_package` jobs)

### Integration Points

1. **Job Type**: Add `deep_soul` or extend `nuclear_package` to include song
2. **Worker**: Add `songWorker.ts` to process song generation
3. **Artifacts**: Store song as `job_artifacts` with `artifact_type: 'song'`
4. **UI**: Add song section to `MyLibraryScreen.tsx` and `PersonReadingsScreen.tsx`

## Next Steps

### Immediate (Before Implementation)

1. **Verify MiniMax API**
   - Check official API documentation
   - Test music generation endpoint
   - Verify vocals support
   - Check style control capabilities

2. **Contact MiniMax**
   - Request API documentation
   - Ask about music generation API access
   - Inquire about style control and vocals

### If Feasible

3. **Prototype**
   - Implement lyrics generation (DeepSeek)
   - Test MiniMax API with sample lyrics
   - Verify output quality and format

4. **Full Implementation**
   - Add song generation worker
   - Integrate into deep reading pipeline
   - Add UI components
   - Test end-to-end

### If Not Feasible

5. **Alternative Approach**
   - Implement lyrics generation
   - Use alternative music service
   - Or wait for MiniMax API support

## Conclusion

**Feasibility**: ⚠️ **UNCERTAIN** - Requires API verification

**Recommendation**:
1. **First**: Verify MiniMax API capabilities for music generation
2. **If supported**: Implement full pipeline as outlined
3. **If not supported**: Consider alternatives or wait for API updates

**Architecture**: The proposed architecture is sound and ready to implement once API capabilities are confirmed. The integration with your existing audio infrastructure is straightforward.

**Action Required**: Contact MiniMax support or check their API documentation to verify music generation endpoint availability and capabilities.

