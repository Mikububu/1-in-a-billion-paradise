# MiniMax Song Generation - Feasibility Analysis

## Executive Summary

**Status**: ⚠️ **UNCERTAIN - Requires API Documentation Verification**

MiniMax has recently introduced music/song generation capabilities, but **API access for full song generation with vocals is unclear** from publicly available information. This analysis provides a feasibility assessment and architecture recommendation based on available information.

## Feature Requirements

1. **Lyrics Generation**: DeepSeek LLM generates personalized lyrics from deep reading data
2. **Song Generation**: MiniMax API generates full song with vocals from lyrics
3. **Style**: 70% Leonard Cohen, 20% Paul Simon, 10% Tom Waits
   - Deep male voice
   - Dark, poetic, intimate tone
   - Minimal, emotionally intimate (not pop/commercial)
4. **Storage & Playback**: Store in user's reading library alongside audiobook and PDF

## MiniMax API Capabilities - Current Status

### ✅ Confirmed Capabilities
- MiniMax has music generation capabilities (recently introduced)
- MiniMax API exists and supports various endpoints
- You have a valid MiniMax API key

### ❓ Unknown/Unclear
- **Full song generation with vocals via API**: Status unclear
- **Lyrics as structured input**: Not confirmed
- **Voice style control**: Not confirmed
- **Stylistic consistency**: Not confirmed
- **Audio format output**: Not confirmed

### ⚠️ Potential Limitations
- Music generation may be **UI-only** (not API accessible)
- API may support **instrumental only** (no vocals)
- Style control may be **limited** or **prompt-based only**
- May require **fine-tuning** or **custom models** for specific voice styles

## Verification Checklist

To determine feasibility, verify the following:

### 1. API Endpoint Verification
- [ ] Check MiniMax API documentation for music/song generation endpoint
- [ ] Verify endpoint supports full song generation (not just instrumental)
- [ ] Confirm vocals are included in API output
- [ ] Check if endpoint accepts lyrics as input parameter

### 2. Input/Output Format
- [ ] Verify lyrics can be passed as structured text input
- [ ] Check audio format returned (MP3, WAV, etc.)
- [ ] Verify format is suitable for storage and playback
- [ ] Check file size limits and generation time

### 3. Style Control
- [ ] Verify voice style can be controlled via API parameters
- [ ] Check if style references (Cohen/Simon/Waits) are supported
- [ ] Confirm tone/emotion parameters are available
- [ ] Check if custom voice models are supported

### 4. API Access vs UI
- [ ] Confirm music generation is available via API (not UI-only)
- [ ] Check if API requires special permissions or enterprise plan
- [ ] Verify rate limits and pricing for music generation

## Architecture Recommendation

### If API Supports Full Song Generation

#### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deep Reading Job                          │
│  (nuclear_package or deep_soul reading type)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Generate Lyrics (DeepSeek LLM)                      │
│  - Input: Deep reading data (soul themes, emotions, etc.)    │
│  - Prompt: Generate personalized lyrics with user's name     │
│  - Output: Structured lyrics text                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Generate Song (MiniMax API)                         │
│  - Input: Lyrics + style parameters                          │
│  - Style: 70% Cohen, 20% Simon, 10% Waits                    │
│  - Voice: Deep male, dark, poetic, intimate                   │
│  - Output: Audio file (MP3/WAV)                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Store & Link                                        │
│  - Upload to Supabase Storage (job-artifacts bucket)         │
│  - Create job_artifacts record (type: 'song')                 │
│  - Link to reading job                                        │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation Plan

**1. Backend: Lyrics Generation Service**
```typescript
// src/services/lyricsGenerator.ts
export async function generatePersonalizedLyrics(
  readingData: DeepReadingData,
  userName: string
): Promise<string> {
  const prompt = `
Generate personalized song lyrics for ${userName} based on their deep soul reading.

Soul Themes: ${readingData.soulThemes}
Emotional Patterns: ${readingData.emotionalPatterns}
Fears: ${readingData.fears}
Desires: ${readingData.desires}
Life Direction: ${readingData.lifeDirection}

Requirements:
- Must explicitly include the name "${userName}"
- Reflect the soul themes and emotional patterns
- Dark, poetic, intimate tone
- Minimal, emotionally resonant
- 3-4 verses with a chorus
- Style: Leonard Cohen meets Paul Simon with Tom Waits edge
`;

  // Use DeepSeek LLM
  const lyrics = await generateWithDeepSeek(prompt);
  return lyrics;
}
```

**2. Backend: Song Generation Service**
```typescript
// src/services/songGenerator.ts
export async function generateSongFromLyrics(
  lyrics: string,
  styleParams: SongStyleParams
): Promise<Buffer> {
  const response = await fetch('https://api.minimax.ai/v1/music/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await apiKeys.minimax()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lyrics: lyrics,
      style: {
        voice: 'deep_male',
        tone: 'dark_poetic_intimate',
        reference_blend: {
          leonard_cohen: 0.7,
          paul_simon: 0.2,
          tom_waits: 0.1,
        },
        minimal: true,
        commercial: false,
      },
      format: 'mp3',
      quality: 'high',
    }),
  });

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}
```

**3. Backend: Song Worker**
```typescript
// src/workers/songWorker.ts
export async function processSongGeneration(jobId: string, taskId: string) {
  // 1. Get deep reading data
  const readingData = await getDeepReadingData(jobId);
  
  // 2. Generate lyrics
  const lyrics = await generatePersonalizedLyrics(
    readingData,
    readingData.userName
  );
  
  // 3. Generate song
  const songBuffer = await generateSongFromLyrics(lyrics, styleParams);
  
  // 4. Upload to storage
  const songUrl = await uploadSongToStorage(jobId, songBuffer);
  
  // 5. Create artifact record
  await createSongArtifact(jobId, songUrl, lyrics);
}
```

**4. Frontend: Library Integration**
```typescript
// src/screens/home/MyLibraryScreen.tsx
// Add "Your Song" section alongside audiobook and PDF

<View style={styles.songSection}>
  <Text style={styles.sectionTitle}>Your Song</Text>
  <TouchableOpacity 
    style={styles.playButton}
    onPress={() => playSong(reading.songUrl)}
  >
    <Text>▶ Play Song</Text>
  </TouchableOpacity>
  <TouchableOpacity 
    style={styles.downloadButton}
    onPress={() => downloadSong(reading.songUrl)}
  >
    <Text>⬇ Download</Text>
  </TouchableOpacity>
</View>
```

### If API Does NOT Support Full Song Generation

#### Alternative Architecture Options

**Option 1: Instrumental + Separate Vocals**
- Generate instrumental via MiniMax API
- Generate vocals separately (TTS with style control)
- Combine using audio processing library

**Option 2: TTS with Music Background**
- Generate lyrics (DeepSeek)
- Generate spoken/recited version with TTS (RunPod Chatterbox with style)
- Add instrumental background (MiniMax or other service)
- Mix audio tracks

**Option 3: Wait for API Support**
- Monitor MiniMax API updates
- Implement lyrics generation now
- Add song generation when API becomes available

## Database Schema

```sql
-- Add song artifact type to existing job_artifacts table
ALTER TABLE job_artifacts 
ADD COLUMN IF NOT EXISTS artifact_type TEXT DEFAULT 'audio';

-- Song-specific metadata (optional separate table)
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

## Next Steps

### Immediate Actions

1. **Verify MiniMax API Documentation**
   - Check official MiniMax API docs for music generation endpoint
   - Contact MiniMax support if documentation is unclear
   - Request API access if required

2. **Test API Access**
   - Test music generation endpoint with sample lyrics
   - Verify output format and quality
   - Check style control capabilities

3. **Prototype Implementation**
   - Implement lyrics generation (DeepSeek)
   - Test MiniMax API with sample lyrics
   - Verify audio output quality and format

### If Feasible

4. **Full Implementation**
   - Add song generation worker
   - Integrate into deep reading job pipeline
   - Add UI components for song playback
   - Test end-to-end flow

### If Not Feasible

5. **Alternative Approach**
   - Implement lyrics generation
   - Use alternative music generation service
   - Or wait for MiniMax API support

## Conclusion

**Feasibility**: ⚠️ **UNCERTAIN** - Requires API documentation verification

**Recommendation**: 
1. **Verify MiniMax API capabilities** first
2. If API supports it → Implement full pipeline
3. If API doesn't support it → Consider alternatives or wait for API updates

**Architecture**: The proposed architecture is sound and ready to implement once API capabilities are confirmed.

