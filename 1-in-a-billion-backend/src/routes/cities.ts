/**
 * CITY SEARCH ROUTE
 * 
 * Uses Google Places API for accurate city search with timezone data.
 * Required for astrology calculations.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../config/env';
import { createSupabaseServiceClient } from '../services/supabaseClient';

const router = new Hono();

// Get Google API key from Supabase or .env
async function getGoogleApiKey(): Promise<string | null> {
  // Try Supabase first (if api_keys table exists)
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('token')
      .eq('service', 'google_places')
      .single();
    
    if (!error && data?.token) {
      return data.token;
    }
  } catch (err: any) {
    // Table might not exist yet - that's OK, fallback to .env
    if (!err.message?.includes('PGRST205')) {
      console.warn('[Cities] Supabase lookup failed:', err.message);
    }
  }
  
  // Fallback to .env
  return env.GOOGLE_PLACES_API_KEY || null;
}

// City search endpoint
router.get('/search', async (c) => {
  const query = c.req.query('q');
  
  if (!query || query.length < 2) {
    return c.json({ cities: [] }, 200);
  }

  const apiKey = await getGoogleApiKey();
  
  if (!apiKey) {
    console.error('[Cities] No Google Places API key found');
    return c.json({ error: 'City search not configured' }, 500);
  }

  try {
    // Google Places Autocomplete API
    // Use geocode (not cities) so towns/villages work too.
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=geocode&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Cities] Google API status:', data.status);
      return c.json({ cities: [] }, 200);
    }

    // Get place details for timezone (requires second API call)
    // Return up to 50 results from Google Places
    const cities = await Promise.all(
      (data.predictions || []).slice(0, 50).map(async (prediction: any) => {
        // Get place details for coordinates and timezone
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,address_components,utc_offset&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();
        
        if (detailsData.status !== 'OK' || !detailsData.result) {
          return null;
        }

        const result = detailsData.result;
        const location = result.geometry?.location;
        
        // Extract city, region, country from address_components
        // IMPORTANT: Never overwrite the city with the region (this caused "Villach" → "Carinthia").
        let cityName =
          prediction?.structured_formatting?.main_text ||
          prediction?.description?.split?.(',')?.[0] ||
          '';

        let locality = '';
        let admin3 = '';
        let admin2 = '';
        let admin1 = '';
        let country = '';
        
        if (result.address_components) {
          for (const comp of result.address_components) {
            const types: string[] = comp.types || [];
            if (types.includes('locality') || types.includes('postal_town')) {
              locality = comp.long_name;
            }
            if (types.includes('administrative_area_level_3')) admin3 = comp.long_name;
            if (types.includes('administrative_area_level_2')) admin2 = comp.long_name;
            if (types.includes('administrative_area_level_1')) admin1 = comp.long_name;
            if (types.includes('country')) country = comp.long_name;
          }
        }

        // Prefer a real locality for "name", fall back to smaller admin areas, then prediction main_text.
        cityName = locality || admin3 || cityName;
        // Use the highest-level region we have (state/province), otherwise fall back to smaller admin.
        const region = admin1 || admin2 || admin3 || '';

        // Estimate timezone from coordinates (Google doesn't provide IANA timezone in basic details)
        // For production, you'd use Time Zone API, but for now estimate from longitude
        const timezone = estimateTimezone(location?.lng || 0);

        return {
          id: prediction.place_id,
          name: cityName,
          country: country || prediction.description.split(',').pop()?.trim() || '',
          region: region,
          latitude: location?.lat || 0,
          longitude: location?.lng || 0,
          timezone: timezone,
        };
      })
    );

    // Filter out nulls
    const validCities = cities.filter(c => c !== null);
    
    return c.json({ cities: validCities }, 200);
    
  } catch (error: any) {
    console.error('[Cities] Search error:', error);
    return c.json({ error: 'City search failed', details: error.message }, 500);
  }
});

// Rough timezone estimation from longitude
function estimateTimezone(longitude: number): string {
  const offset = Math.round(longitude / 15);
  if (offset >= 0) {
    return `Etc/GMT-${offset}`;
  }
  return `Etc/GMT+${Math.abs(offset)}`;
}

export default router;

