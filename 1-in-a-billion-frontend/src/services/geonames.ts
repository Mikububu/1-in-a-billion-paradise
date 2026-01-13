import { CityOption } from '@/types/forms';
import { env } from '@/config/env';

/**
 * Search cities using Google Places API (via backend)
 * Returns real cities from Google's database - no fallback list
 * Now includes districts/towns, not just cities
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

/**
 * Reverse geocode coordinates to get city name
 * Useful when you only have coordinates and need to find the city
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<CityOption | null> {
  if (!latitude || !longitude) return null;

  try {
    const url = `${env.CORE_API_URL}/api/cities/reverse?lat=${latitude}&lng=${longitude}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Reverse geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn('Reverse geocoding error:', data.error);
      return null;
    }

    return {
      id: `coord_${latitude}_${longitude}`,
      name: data.name,
      country: data.country,
      region: data.region,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}
