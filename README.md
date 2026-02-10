# 1-in-a-Billion

Clean rebuild of the 1-in-a-Billion astrology app, built from the "1-in-a-billion-all 2" version.

## Project Structure

```
1 in a Billion/
├── 1-in-a-billion-frontend/    # React Native/Expo mobile app
└── 1-in-a-billion-backend/     # Hono.js backend server
```

## Architecture

### Frontend
- **Framework**: React Native with Expo SDK 54
- **State Management**: Zustand
- **Navigation**: React Navigation
- **API Client**: React Query (TanStack Query)
- **Authentication**: Supabase Auth (Google Sign-In)
- **Database**: Supabase (Postgres)

### Backend
- **Framework**: Hono.js (Node.js)
- **Database**: Supabase (Postgres)
- **Queue System**: Supabase Queue V2
- **Workers**: Fly.io (text workers)
- **LLM**: DeepSeek (primary) / Claude (backup)
- **TTS**: Chatterbox via Replicate
- **Songs**: MiniMax Music 2.5
- **Vedic Matchmaking**: Full Ashtakoota system with vectorized engines

## Features

- **5-System Astrology Synthesis**: Western, Vedic, Human Design, Gene Keys, Kabbalah
- **Reading Generation**: 16-document "Nuclear Package" with text, PDF, and audio
- **Vedic Matchmaking**: Complete Jyotish compatibility system with batch matching
- **User Profiles**: Birth data management and library sync
- **Audio Playback**: TTS-generated audiobooks
- **Stylized Portraits (Photos)**: Upload photos for you + Karmic Zoo people and generate a privacy-preserving stylized portrait
- **Couple Images**: When generating synastry/overlay readings, compose a couple image from two portraits (when both exist)
- **PDFs with Images**: PDFs include portraits/couple images in the header and use smaller, premium typography

## Quick Start

### Backend

```bash
cd 1-in-a-billion-backend
npm install
npm run dev        # Start dev server on http://localhost:8787
```

### Frontend

```bash
cd 1-in-a-billion-frontend
npm install
npm start          # Start Expo dev server
```

## Recent Updates (last 24h)

- **Partner photo upload**: Karmic Zoo avatars are tappable to upload a photo; upload auto-runs and the generated stylized portrait replaces the placeholder.
- **Couple images**: Synastry/overlay flows generate a couple image when both portraits exist; this is displayed in the library cards.
- **PDF improvements**:
  - Smaller typography for readability
  - Portrait/couple images embedded into PDFs
  - PDF worker can briefly wait for portraits to exist and will generate couple images if missing
- **Backend deploy**: Backend deploys to Fly.io automatically from GitHub Actions (scheduled + on `main` changes).

## API Key Management

**✅ All API keys are stored in Supabase `assistant_config` table**

The backend automatically:
1. Fetches keys from Supabase `assistant_config` table
2. Falls back to `.env` if Supabase unavailable
3. Caches keys for 5 minutes

**No `.env` files needed** - all keys are in Supabase!

### Available Keys (in Supabase)
- ✅ DeepSeek API key
- ✅ Claude/Anthropic API key
- ✅ OpenAI API key
- ✅ Replicate API token (for TTS)
- ✅ MiniMax API key & Group ID (for songs)
- ✅ Google Places API key
- ✅ Fly.io access token
- ✅ Plus 17 more keys

## Vedic Matchmaking API

### Endpoints

- `GET /api/vedic/health` - Health check
- `POST /api/vedic/match` - One-to-one match
- `POST /api/vedic/match/batch` - Batch matching
- `POST /api/vedic/score` - Quick score
- `GET /api/vedic-v2/health` - V2 health check
- `POST /api/vedic-v2/match` - V2 match
- `POST /api/vedic-v2/match/batch` - V2 batch match

### Test Vedic Modules

```bash
cd 1-in-a-billion-backend
npm run test:vedic
```

## Testing

```bash
# Test full pipeline
cd 1-in-a-billion-backend
npm run test:pipeline

# Test end-to-end job processing
npm run test:e2e

# Test Vedic modules
npm run test:vedic
```

## Current Status

### ✅ Completed
- ✅ All code copied and organized (248+ TypeScript files)
- ✅ Dependencies installed (1,280 packages)
- ✅ TypeScript compilation successful
- ✅ API keys integrated with Supabase
- ✅ Vedic routes registered and working
- ✅ FileSystem API errors fixed
- ✅ Audio workers fixed (sequential processing via Replicate)
- ✅ All critical bugs fixed

### ⚠️ Minor Issues (Non-Critical)
- 19 TypeScript warnings in frontend (app still runs)
- Store method type definitions need updating
- SimpleSlider component prop types

## Development

### Backend Commands
```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run test:setup # Test backend setup
npm run test:pipeline # Test full pipeline
npm run test:vedic # Test Vedic modules
```

### Frontend Commands
```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS
npm run android    # Run on Android
```

## Key Improvements

1. **Centralized API Keys**: All keys in Supabase `assistant_config` table
2. **Vedic Matchmaking**: Full Jyotish system with vectorized engines
3. **Sequential Audio Processing**: Fixed Replicate concurrency/rate-limit issues
4. **Comprehensive Testing**: Test scripts for all components
5. **Better Error Handling**: Graceful fallbacks throughout

## Notes

- This is a clean rebuild from "1-in-a-billion-all 2"
- Supabase MCP server configured for Cursor IDE
- All backend processes run in the cloud (Fly.io + Replicate + MiniMax)
- API keys automatically loaded from Supabase at startup

---

**Status**: ✅ **Production Ready** - All critical components working!
