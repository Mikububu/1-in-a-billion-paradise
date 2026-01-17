# Timezone Bug Investigation & Fix

## Date: January 17, 2026

## Summary
Rising sign calculations were returning wrong results (e.g., Libra instead of Gemini) because the Google Timezone API was never enabled in Google Cloud Console, causing all cities to return `timezone: "UTC"`.

---

## The Bug

### Symptoms
- Users reported wrong Rising signs
- Example: Birth data `1998-03-24, 11:00 AM, Tagum, Davao (Philippines)` returned:
  - ❌ Libra Rising (incorrect)
  - ✅ Gemini Rising (correct)

### Why Rising Sign is Sensitive
The Rising sign (Ascendant) changes approximately every 2 hours. A timezone error of 8 hours (UTC vs Asia/Manila) shifts the Rising sign by ~4 signs.

---

## Root Cause Analysis

### Timeline

| Date | Commit | What Happened |
|------|--------|---------------|
| Jan 7 | `f486164` | City search created with **longitude-based timezone estimation** (worked fine) |
| Jan 13 | `a574ef8` | Google Timezone API added for `/reverse` endpoint |
| Jan 13 | `0ce2258` | Google Timezone API added for `/search` endpoint **BUT API WAS NEVER ENABLED** |
| Jan 13+ | - | All cities returned `timezone: "UTC"` → wrong Rising signs |

### The Original Working Code (Jan 7)
```javascript
// Estimate timezone from coordinates (Google doesn't provide IANA timezone in basic details)
// For production, you'd use Time Zone API, but for now estimate from longitude
const timezone = estimateTimezone(location?.lng || 0);

function estimateTimezone(longitude: number): string {
  const offset = Math.round(longitude / 15);
  if (offset >= 0) {
    return `Etc/GMT-${offset}`;
  }
  return `Etc/GMT+${Math.abs(offset)}`;
}
```

### The Broken Code (Jan 13+)
```javascript
// Get timezone using Google Timezone API
const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?...`;
const timezoneData = await axios.get(timezoneUrl);

const timezone = timezoneData.status === 'OK' 
    ? timezoneData.timeZoneId 
    : 'UTC'; // <-- FALLBACK TO UTC WHEN API FAILS!
```

### Google API Error Response
```json
{
  "status": "REQUEST_DENIED",
  "errorMessage": "This API is not activated on your API project. You may need to enable this API in the Google Cloud Console: https://console.cloud.google.com/apis/library?filter=category:maps"
}
```

---

## The Fix

### Solution: Intelligent Fallback System

When Google Timezone API fails, use country-based IANA timezone lookup:

```javascript
const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
    'Philippines': 'Asia/Manila',
    'Japan': 'Asia/Tokyo',
    'Germany': 'Europe/Berlin',
    'United States': 'America/New_York', // Refined by longitude
    // ... 50+ countries
};

function estimateTimezone(longitude: number, country: string): string {
    // US/Canada: Use longitude to pick Pacific/Mountain/Central/Eastern
    // Other countries: Use COUNTRY_TIMEZONE_MAP
    // Fallback: Etc/GMT+X based on longitude
}
```

### Key Code Changes

**File:** `1-in-a-billion-backend/src/routes/cities.ts`

1. Added `COUNTRY_TIMEZONE_MAP` with 50+ countries
2. Added `estimateTimezone(longitude, country)` function
3. Modified timezone fetching:
   ```javascript
   // Start with fallback estimate
   let timezone = estimateTimezone(location.lng, country);
   
   try {
       const timezoneResponse = await axios.get(timezoneUrl);
       if (timezoneData.status === 'OK') {
           timezone = timezoneData.timeZoneId; // Use Google when available
       }
   } catch (e) {
       // Use fallback (already set above)
   }
   ```

---

## How to Enable Google Timezone API

For maximum accuracy (especially for edge cases), enable the API:

1. Go to: https://console.cloud.google.com/apis/library
2. Search for **"Time Zone API"**
3. Click **"ENABLE"**
4. Ensure it's on the same project as your `google_places` API key

---

## Verification

### Test Command
```bash
curl -s "https://1-in-a-billion-backend.fly.dev/api/cities/search?q=Tagum%20davao" | jq '.cities[0]'
```

### Expected Result
```json
{
  "name": "Tagum",
  "country": "Philippines",
  "timezone": "Asia/Manila",  // ✅ NOT "UTC"
  "latitude": 7.447415599999998,
  "longitude": 125.8024578
}
```

### Swiss Ephemeris Verification
```bash
curl -X POST "https://1-in-a-billion-backend.fly.dev/api/reading/placements" \
  -H "Content-Type: application/json" \
  -d '{
    "birthDate": "1998-03-24",
    "birthTime": "11:00",
    "timezone": "Asia/Manila",
    "latitude": 7.4474,
    "longitude": 125.8078,
    "system": "western"
  }'
```

**Expected:** `risingSign: "Gemini"` (not "Libra")

---

## Key Learnings

1. **Always verify external APIs are enabled** in cloud console
2. **Never silently fallback to UTC** - it causes subtle but serious bugs
3. **Rising sign is extremely time-sensitive** - timezone errors cause completely wrong results
4. **Implement intelligent fallbacks** - country-based timezone mapping is more reliable than just offsets

---

## Related Files

- `1-in-a-billion-backend/src/routes/cities.ts` - City search with timezone
- `1-in-a-billion-backend/src/routes/readings.ts` - Has a secondary timezone safety net
- `1-in-a-billion-backend/src/services/swissEphemeris.ts` - Swiss Ephemeris calculations

---

## Commits

- `169f751` - Fix: Timezone fallback for city search when Google Timezone API is disabled
- `c42f3ea` - Fix timezone bug causing wrong Rising sign calculations (backend safety net)
