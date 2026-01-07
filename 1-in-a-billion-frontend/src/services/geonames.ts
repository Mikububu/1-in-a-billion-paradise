import { CityOption } from '@/types/forms';
import { env } from '@/config/env';

/**
 * Search cities using Google Places API (via backend)
 * Returns real cities from Google's database - no fallback list
 */
export async function searchCities(query: string): Promise<CityOption[]> {
  if (!query || query.length < 2) return [];

  try {
    // Call backend Google Places API endpoint
    const url = `${env.CORE_API_URL}/api/cities/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('City search API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.cities || data.cities.length === 0) {
      return [];
    }

    return data.cities;
  } catch (error) {
    console.warn('City search failed:', error);
    return [];
  }
}

