# Song Generation Pipeline - Implementation Complete ✅

## Overview

Full pipeline implemented for generating personalized songs for paid users who purchase deep soul readings. The system analyzes reading text through psychological evaluation to determine mood, extracts lyrics from the long text, and generates a full song with vocals using MiniMax Music API infused with 50 iconic 70s/80s musicians.

## Key Features

### 1. Psychological Evaluation
- **Mood Analysis**: Analyzes the reading text to determine primary emotion (sad, happy, dark, triumphant, melancholic, chaotic, hopeful, angry, peaceful)
- **Vocal Style Determination**: Based on psychological analysis, determines:
  - **Gender**: Man, Woman, or Choir
  - **Format**: Solo, Duet, or Choir
  - Can be based on reading content or random selection

### 2. Lyrics Extraction
- Extracts key themes and emotional essence from the long reading text
- Removes astrology jargon, focuses on life struggles, emotions, relationships
- Creates personalized lyrics that capture the person's story

### 3. 50 Musicians from 70s/80s
The system randomly selects from a pool of 50 iconic artists/groups to infuse into MiniMax:
- The Who, Rolling Stones, David Bowie, Carole King, Paul Simon, Celine Dion, Bruce Springsteen, ABBA, Aretha Franklin, Fleetwood Mac, Billy Joel, Joni Mitchell, Phil Collins, Whitney Houston, Elton John, Led Zeppelin, Pink Floyd, Queen, The Beatles, The Doors, Stevie Wonder, Marvin Gaye, Donna Summer, Bee Gees, Earth Wind & Fire, Chic, Blondie, Talking Heads, The Clash, The Police, U2, Dire Straits, Genesis, Yes, Rush, Journey, Foreigner, Boston, Kansas, Styx, REO Speedwagon, Heart, Pat Benatar, Cyndi Lauper, Madonna, Prince, Michael Jackson, Tina Turner, Eurythmics, Duran Duran, and more

**Legal Note**: MiniMax generates original music inspired by these styles, not copying. No legal issues as it's creating new compositions in the style of these artists.

## Cost

**MiniMax Pricing**: ~$0.0825 per 3-minute song
- 1 credit = 1 song (regardless of length)
- 120 credits = $9.90
- Commercial use rights included

## Architecture

### Backend Components

1. **Database Migration** (`013_add_song_generation.sql`)
   - Added `song_generation` to `task_type` enum
   - Added `audio_song` to `artifact_type` enum

2. **Lyrics Generation Service** (`src/services/lyricsGeneration.ts`)
   - Uses DeepSeek to generate personalized lyrics
   - **Psychological Evaluation**: Analyzes the reading text to determine emotional mood (sad, happy, dark, triumphant, melancholic, chaotic, etc.)
   - **Lyrics Extraction**: Extracts key themes and emotional essence from the long reading text
   - **Vocal Style Determination**: Based on psychological analysis, determines:
     - Gender: Man, Woman, or Choir
     - Format: Solo, Duet, or Choir
     - This can be based on reading content or random selection
   - **50 Musicians from 70s/80s**: Randomly selects from a pool of 50 iconic artists/groups:
     - The Who, Rolling Stones, David Bowie, Carole King, Paul Simon, Celine Dion, Bruce Springsteen, ABBA, Aretha Franklin, Fleetwood Mac, Billy Joel, Joni Mitchell, Phil Collins, Whitney Houston, Elton John, and 35+ more
   - **MiniMax Infusion**: These artist names are infused into the MiniMax prompt to guide musical style
   - No legal issues: MiniMax generates original music inspired by these styles, not copying

3. **Song Generation Service** (`src/services/songGeneration.ts`)
   - Uses MiniMax Music API (`https://platform.minimax.io/v1/music_generation`)
   - Generates 3-minute songs with deep male vocals
   - Dark, poetic, intimate style
   - Returns audio URL or base64

4. **Song Worker** (`src/workers/songWorker.ts` + `songTaskProcessor.ts`)
   - Extends `BaseWorker` to process `song_generation` tasks
   - Fetches all reading documents
   - Generates lyrics → generates song → uploads to storage
   - Creates artifact record

5. **Job Integration** (`src/routes/jobs.ts`)
   - Adds `song_generation` task to `nuclear_v2` jobs
   - Task sequence: 16 (after all text/PDF/audio tasks)
   - Can be disabled with `includeSong: false` in payload

### Frontend Components

1. **Type Updates** (`src/services/nuclearReadingsService.ts`)
   - Added `audio_song` to `JobArtifact` type
   - Added song metadata (lyrics, duration, style)

2. **Display** (TODO: Add to FullReadingScreen or DeepReadingReaderScreen)
   - Show "Your Song" section with play button
   - Display lyrics if available
   - Download option

## Flow

```
1. User purchases deep soul reading (nuclear_v2)
2. Backend creates job with 16 text tasks + 1 song task
3. Text tasks complete → PDFs generated → Audio generated
4. Song task starts:
   a. Fetch all reading documents
   b. Combine text → Generate lyrics (DeepSeek)
   c. Generate song (MiniMax) → Upload to storage
   d. Create artifact record
5. Frontend displays song in reading library
```

## API Endpoints

### MiniMax Music API
- **Base URL**: `https://platform.minimax.io`
- **Endpoint**: `/v1/music_generation`
- **Method**: POST
- **Auth**: Bearer token (from Supabase `api_keys` table)

### Request Format
```json
{
  "model": "music-1.5",
  "prompt": "A dark, poetic song with deep male vocals...",
  "lyrics": "Generated lyrics here...",
  "style": "dark_poetic",
  "emotion": "intimate",
  "duration": 180
}
```

### Response Format
```json
{
  "data": {
    "audio_url": "...",
    "audio_base64": "...",
    "duration": 180
  },
  "trace_id": "...",
  "extra_info": {...},
  "analysis_info": {...}
}
```

## Configuration

### Environment Variables
- `MINIMAX_API_KEY` (optional, fallback if not in Supabase)
- `ENABLE_SONG_WORKER` (default: true, set to 'false' to disable)

### Supabase
- API key stored in `api_keys` table with `service: 'minimax'`
- Songs stored in `job-artifacts` bucket
- Artifacts tracked in `job_artifacts` table

## Testing

1. **Test Lyrics Generation**:
   ```bash
   cd 1-in-a-billion-backend
   npx ts-node src/scripts/testLyricsGeneration.ts
   ```

2. **Test Song Generation**:
   ```bash
   npx ts-node src/scripts/testSongGeneration.ts
   ```

3. **Test Full Pipeline**:
   - Create a nuclear_v2 job with `includeSong: true`
   - Monitor worker logs for song generation
   - Check Supabase for `audio_song` artifact

## Next Steps

1. ✅ Backend implementation complete
2. ⏳ Frontend display (add song section to reading screens)
3. ⏳ Add paid user check (only generate for paid users)
4. ⏳ Add error handling for API failures
5. ⏳ Add retry logic for failed song generations

## Files Created/Modified

### Backend
- `migrations/013_add_song_generation.sql`
- `src/services/lyricsGeneration.ts`
- `src/services/songGeneration.ts`
- `src/workers/songWorker.ts`
- `src/workers/songTaskProcessor.ts`
- `src/routes/jobs.ts` (modified)
- `src/server.ts` (modified - register song worker)

### Frontend
- `src/services/nuclearReadingsService.ts` (modified - added audio_song type)

## Notes

- Song generation happens **after** all other tasks complete
- Songs are stored in Supabase Storage (`job-artifacts` bucket)
- Lyrics are stored in artifact metadata
- Worker processes one song at a time (API rate limits)
- Cost: ~$0.08 per song (very affordable!)

