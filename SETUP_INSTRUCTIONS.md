# Paradise Setup Instructions

## Quick Start

### 1. Backend Setup

```bash
cd Paradise/1-in-a-billion-backend
npm install
```

### 2. API Keys Configuration

**✅ All API keys are already in Supabase `assistant_config` table!**

The backend automatically fetches keys from Supabase. No manual setup needed.

**How it works:**
1. Backend checks `assistant_config` table for keys
2. Falls back to `.env` if Supabase unavailable
3. Keys are cached for 5 minutes

**Available keys in Supabase:**
- ✅ DeepSeek, Claude, OpenAI API keys
- ✅ RunPod API key & endpoint ID
- ✅ Google Places API key
- ✅ Fly.io access token
- ✅ Plus 17 more keys

### 3. Test Backend

```bash
npm run test:setup
```

This will verify:
- ✅ Supabase connection
- ✅ API key fetching
- ✅ LLM service initialization

### 4. Start Backend

```bash
npm run dev
```

The backend will:
- Preload API keys from Supabase at startup
- Start on http://localhost:8787
- Enable text worker and auto-scaler

### 5. Frontend Setup

```bash
cd ../1-in-a-billion-frontend
npm install
```

The `.env` file is already configured with Supabase credentials.

### 6. Start Frontend

```bash
npm start
```

## Troubleshooting

### API Keys Not Found

If `npm run test:setup` shows API keys not found:

1. **Check Supabase `assistant_config` table**:
   ```sql
   SELECT key, value FROM assistant_config WHERE key LIKE '%API_KEY%';
   ```

2. **Keys are automatically mapped**:
   - `deepseek` → `DEEPSEEK_API_KEY`
   - `claude` → `ANTHROPIC_API_KEY`
   - `runpod` → `RUNPOD_API_KEY`
   - `runpod_endpoint` → `RUNPOD_ENDPOINT_ID`

### Supabase Connection Failed

1. Check `.env` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Verify credentials in Supabase Dashboard → Settings → API
3. Test connection: `npm run test:setup`

### LLM Service Errors

If LLM service fails to initialize:

1. Ensure at least one API key exists in Supabase `api_keys` table
2. Or add keys to `.env` as fallback:
   ```
   DEEPSEEK_API_KEY=your-key
   CLAUDE_API_KEY=your-key
   ```

## Current Status

- ✅ Project structure created
- ✅ Dependencies installed
- ✅ Configuration files created
- ✅ API key service implemented
- ✅ All API keys in Supabase `assistant_config` table
- ✅ Backend automatically fetches keys from Supabase
- ✅ Vedic routes registered and working
- ✅ All critical bugs fixed

## Next Steps

1. ✅ Backend dependencies installed
2. ✅ Supabase credentials configured
3. ✅ API keys accessible from Supabase
4. ✅ Test backend: `npm run test:setup`
5. ✅ Start backend: `npm run dev`
6. ✅ Test frontend: `npm start` (in frontend directory)

