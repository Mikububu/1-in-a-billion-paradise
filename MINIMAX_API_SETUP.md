# MiniMax API Setup

## ✅ API Key Status

The MiniMax API key is **already in Supabase** (`assistant_config` table as `MINIMAX_API_KEY`).

**Key**: `sk-api-xWT7nhj_tK-5XckrK03LCM_CSAlQuzODSgicp0RvVuZc6rtNpjAaT3FhEHvgHg2kDTEJ1c-XLSZO86DWa6bUtvo-IKqIuXDG_dzYLuarZhlm5yo9M7cS7P0`

## Storage Location

The key exists in:
- ✅ **assistant_config** table: `MINIMAX_API_KEY` (already present)
- ⏳ **api_keys** table: `minimax` (needs to be added for consistency)

### To Add to api_keys Table

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- See: ADD_MINIMAX_TO_API_KEYS.sql for full script
INSERT INTO api_keys (service, key_name, token, description) 
VALUES (
  'minimax', 
  'main', 
  'sk-api-xWT7nhj_tK-5XckrK03LCM_CSAlQuzODSgicp0RvVuZc6rtNpjAaT3FhEHvgHg2kDTEJ1c-XLSZO86DWa6bUtvo-IKqIuXDG_dzYLuarZhlm5yo9M7cS7P0',
  'MiniMax API key for music/song generation'
) 
ON CONFLICT (service) DO UPDATE SET 
  token = EXCLUDED.token, 
  updated_at = NOW();
```

## Code Integration

### Backend Access

```typescript
import { apiKeys } from './services/apiKeysHelper';

// Get MiniMax API key
const minimaxKey = await apiKeys.minimax();
```

### Usage Example

```typescript
// Example: Call MiniMax API
const response = await fetch('https://api.minimax.ai/v1/music/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await apiKeys.minimax()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // API parameters
  }),
});
```

## Next Steps

1. **Verify Key in Supabase**:
   - Go to Supabase Dashboard → Table Editor → `api_keys`
   - Confirm `minimax` service exists with the key

2. **Check MiniMax API Documentation**:
   - Visit: https://www.minimax.io/audio/music
   - Look for API documentation link
   - Verify music generation endpoint

3. **Test API Access**:
   - Test the API key with a simple request
   - Verify authentication works
   - Check available endpoints

## API Documentation

Since MiniMax is open in another window, please check:
- API endpoint URLs
- Request/response formats
- Music generation parameters
- Style control options
- Audio output formats

## Files Updated

- ✅ `src/services/apiKeysHelper.ts` - Added `minimax()` helper
- ✅ `src/config/env.ts` - Added `MINIMAX_API_KEY` env var
- ✅ `src/services/apiKeys.ts` - Added MiniMax to key mapping and preload
- ✅ `migrations/012_add_minimax_key.sql` - Migration to add key to Supabase

