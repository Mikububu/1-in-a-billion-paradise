/**
 * CITY SEARCH API
 *
 * GET /api/cities/search?q=<query>
 *
 * Uses Google Places API to search for cities worldwide.
 * Returns city name, country, timezone, and coordinates.
 */

import { Hono } from 'hono';
import axios from 'axios';
import { getApiKey } from '../services/apiKeys';
import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();

interface CityResult {
    id: string;
    name: string;
    country: string;
    region?: string;
    timezone: string;
    latitude: number;
    longitude: number;
}

/**
 * TIMEZONE FALLBACK: When Google Timezone API is not enabled,
 * estimate timezone from country code + longitude
 * 
 * This provides IANA timezone IDs (not just offsets) for major countries
 */
const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
    // Asia-Pacific
    'Philippines': 'Asia/Manila',
    'Japan': 'Asia/Tokyo',
    'South Korea': 'Asia/Seoul',
    'China': 'Asia/Shanghai',
    'Taiwan': 'Asia/Taipei',
    'Hong Kong': 'Asia/Hong_Kong',
    'Singapore': 'Asia/Singapore',
    'Malaysia': 'Asia/Kuala_Lumpur',
    'Indonesia': 'Asia/Jakarta',
    'Thailand': 'Asia/Bangkok',
    'Vietnam': 'Asia/Ho_Chi_Minh',
    'India': 'Asia/Kolkata',
    'Australia': 'Australia/Sydney',
    'New Zealand': 'Pacific/Auckland',
    // Europe
    'United Kingdom': 'Europe/London',
    'UK': 'Europe/London',
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
    'Spain': 'Europe/Madrid',
    'Italy': 'Europe/Rome',
    'Netherlands': 'Europe/Amsterdam',
    'Belgium': 'Europe/Brussels',
    'Switzerland': 'Europe/Zurich',
    'Austria': 'Europe/Vienna',
    'Poland': 'Europe/Warsaw',
    'Sweden': 'Europe/Stockholm',
    'Norway': 'Europe/Oslo',
    'Denmark': 'Europe/Copenhagen',
    'Finland': 'Europe/Helsinki',
    'Portugal': 'Europe/Lisbon',
    'Greece': 'Europe/Athens',
    'Turkey': 'Europe/Istanbul',
    'Russia': 'Europe/Moscow',
    // Americas
    'United States': 'America/New_York', // Default to Eastern, will be refined by longitude
    'USA': 'America/New_York',
    'Canada': 'America/Toronto',
    'Mexico': 'America/Mexico_City',
    'Brazil': 'America/Sao_Paulo',
    'Argentina': 'America/Buenos_Aires',
    'Chile': 'America/Santiago',
    'Colombia': 'America/Bogota',
    'Peru': 'America/Lima',
    // Middle East & Africa
    'Israel': 'Asia/Jerusalem',
    'United Arab Emirates': 'Asia/Dubai',
    'UAE': 'Asia/Dubai',
    'Saudi Arabia': 'Asia/Riyadh',
    'Egypt': 'Africa/Cairo',
    'South Africa': 'Africa/Johannesburg',
};

/**
 * Estimate timezone from longitude (fallback when Google API fails)
 * For US/Canada, uses longitude to determine specific timezone
 */
function estimateTimezone(longitude: number, country: string): string {
    // First check country-specific timezones
    const countryTz = COUNTRY_TIMEZONE_MAP[country];
    
    // For US/Canada, refine by longitude
    if (country === 'United States' || country === 'USA' || country === 'Canada') {
        if (longitude < -130) return 'America/Anchorage';       // Alaska
        if (longitude < -115) return 'America/Los_Angeles';     // Pacific
        if (longitude < -100) return 'America/Denver';          // Mountain
        if (longitude < -85) return 'America/Chicago';          // Central
        return 'America/New_York';                              // Eastern
    }
    
    if (countryTz) return countryTz;
    
    // Generic fallback: estimate from longitude
    // This is approximate but better than UTC
    const offset = Math.round(longitude / 15);
    
    // Return IANA timezone ID (Etc/GMT uses inverted sign convention)
    if (offset === 0) return 'UTC';
    if (offset > 0) return `Etc/GMT-${offset}`;
    return `Etc/GMT+${Math.abs(offset)}`;
}

/**
 * Helper: Check if a place type array indicates a city/town/locality
 */
function isValidCityType(types: string[]): boolean {
    // Accept: cities, towns, villages, districts, neighborhoods, postal towns
    return types.includes('locality') ||
           types.includes('sublocality') ||
           types.includes('sublocality_level_1') ||
           types.includes('administrative_area_level_2') ||
           types.includes('administrative_area_level_3') ||
           types.includes('administrative_area_level_4') ||
           types.includes('administrative_area_level_5') ||
           types.includes('colloquial_area') ||
           types.includes('neighborhood') ||
           types.includes('postal_town') ||
           types.includes('town') ||
           types.includes('village') ||
           // Accept geocode results that aren't countries or large regions
           (types.includes('geocode') && 
            !types.includes('country') && 
            !types.includes('administrative_area_level_1'));
}

/**
 * GET /search?q=<query>
 * Search for cities using Google Places API
 * 
 * Uses a multi-strategy approach to find cities worldwide:
 * 1. First tries (cities) type for exact city matches
 * 2. Falls back to geocode for broader matches (towns, villages, districts)
 * 3. Finally tries no type restriction for maximum coverage
 */
router.get('/search', async (c) => {
    const query = c.req.query('q');

    if (!query || query.length < 2) {
        return c.json({ cities: [] });
    }

    try {
        const googlePlacesKey = await getApiKey('google_places');
        
        if (!googlePlacesKey) {
            console.error('❌ Google Places API key not found');
            return c.json({ 
                cities: [],
                error: 'Google Places API not configured'
            }, 500);
        }
        
        console.log('🔑 Google Places key prefix:', googlePlacesKey.substring(0, 10) + '...');

        // Multi-strategy search: try different type restrictions to maximize coverage
        // Some cities only appear with certain type filters
        const searchStrategies = [
            { types: '(cities)', name: 'cities' },           // Major cities
            { types: 'geocode', name: 'geocode' },           // All geocodable places
            { types: '(regions)', name: 'regions' },         // Regions, localities
            { types: '', name: 'unrestricted' },             // No restriction (fallback)
        ];

        let allPredictions: any[] = [];
        const seenPlaceIds = new Set<string>();

        for (const strategy of searchStrategies) {
            try {
                const typesParam = strategy.types ? `&types=${strategy.types}` : '';
                const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}${typesParam}&key=${googlePlacesKey}`;
                
                const autocompleteResponse = await axios.get(autocompleteUrl);
                const autocompleteData = autocompleteResponse.data;

                if (autocompleteData.status === 'OK' && autocompleteData.predictions) {
                    // Filter and deduplicate
                    for (const pred of autocompleteData.predictions) {
                        if (seenPlaceIds.has(pred.place_id)) continue;
                        
                        const types = pred.types || [];
                        if (isValidCityType(types)) {
                            seenPlaceIds.add(pred.place_id);
                            allPredictions.push(pred);
                        }
                    }
                }

                // If we have enough results, stop searching
                if (allPredictions.length >= 8) break;
                
            } catch (strategyError) {
                console.warn(`City search strategy '${strategy.name}' failed:`, strategyError);
                // Continue with next strategy
            }
        }

        if (allPredictions.length === 0) {
            console.warn('Google Places Autocomplete returned no results for:', query);
            return c.json({ cities: [] });
        }

        console.log(`🌍 City search for "${query}": found ${allPredictions.length} candidates`);
        

        // Get detailed info for each place (to get coordinates and timezone)
        const cities: CityResult[] = [];

        for (const prediction of allPredictions.slice(0, 8)) {
            try {
                const placeId = prediction.place_id;
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,address_components&key=${googlePlacesKey}`;
                
                const detailsResponse = await axios.get(detailsUrl);
                const detailsData = detailsResponse.data;

                if (detailsData.status !== 'OK' || !detailsData.result) {
                    continue;
                }

                const result = detailsData.result;
                const location = result.geometry?.location;
                
                if (!location) continue;

                // Extract city name and country from address components
                // Priority: locality > sublocality > admin_level_3 > admin_level_2 > postal_town > neighborhood
                const addressComponents = result.address_components || [];
                let cityName = '';
                let country = '';
                let region = '';
                
                // Collect candidates by priority
                let locality = '';
                let sublocality = '';
                let adminLevel2 = '';
                let adminLevel3 = '';
                let adminLevel4 = '';
                let postalTown = '';
                let neighborhood = '';

                for (const component of addressComponents) {
                    const types = component.types || [];
                    
                    if (types.includes('country')) {
                        country = component.long_name;
                    }
                    if (types.includes('administrative_area_level_1')) {
                        region = component.short_name;
                    }
                    if (types.includes('locality')) {
                        locality = component.long_name;
                    }
                    if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
                        sublocality = component.long_name;
                    }
                    if (types.includes('administrative_area_level_2')) {
                        // Clean up common suffixes
                        adminLevel2 = component.long_name
                            .replace(/\s+(District|Province|Prefecture|County|Region|Municipality)$/i, '');
                    }
                    if (types.includes('administrative_area_level_3')) {
                        adminLevel3 = component.long_name
                            .replace(/\s+(District|Barangay|Ward|Township)$/i, '');
                    }
                    if (types.includes('administrative_area_level_4')) {
                        adminLevel4 = component.long_name;
                    }
                    if (types.includes('postal_town')) {
                        postalTown = component.long_name;
                    }
                    if (types.includes('neighborhood')) {
                        neighborhood = component.long_name;
                    }
                }
                
                // Choose best city name by priority
                cityName = locality || sublocality || adminLevel3 || adminLevel2 || adminLevel4 || postalTown || neighborhood || result.name;
                
                // If region is same as city name, try to get a more specific region
                if (region === cityName && adminLevel2 && adminLevel2 !== cityName) {
                    region = adminLevel2;
                }

                // Get timezone using Google Timezone API (with fallback)
                const timestamp = Math.floor(Date.now() / 1000);
                const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${location.lat},${location.lng}&timestamp=${timestamp}&key=${googlePlacesKey}`;
                
                // Start with fallback estimate
                let timezone = estimateTimezone(location.lng, country);
                let usedFallback = true;
                
                try {
                    const timezoneResponse = await axios.get(timezoneUrl);
                    const timezoneData = timezoneResponse.data;
                    
                    if (timezoneData.status === 'OK') {
                        timezone = timezoneData.timeZoneId;
                        usedFallback = false;
                        console.log(`✅ Timezone for ${cityName}: ${timezone} (Google API)`);
                    } else {
                        // API failed - use the pre-calculated fallback
                        console.warn(`⚠️ Google Timezone API unavailable for ${cityName}, using fallback: ${timezone}`);
                        if (timezoneData.errorMessage?.includes('not activated')) {
                            // Only log this once per session to avoid spam
                            console.warn('📋 To fix: Enable "Time Zone API" in Google Cloud Console');
                        }
                    }
                } catch (tzError: any) {
                    // Network error - use the pre-calculated fallback
                    console.warn(`⚠️ Timezone API error for ${cityName}, using fallback: ${timezone}`);
                }

                cities.push({
                    id: placeId,
                    name: cityName,
                    country,
                    region,
                    timezone,
                    latitude: location.lat,
                    longitude: location.lng,
                });
            } catch (error) {
                console.error('Error fetching place details:', error);
                // Continue with other cities
            }
        }

        return c.json({ cities });

    } catch (error: any) {
        console.error('City search error:', error.message);
        return c.json({ 
            cities: [],
            error: 'City search failed'
        }, 500);
    }
});

/**
 * GET /reverse?lat=<latitude>&lng=<longitude>
 * Reverse geocode coordinates to get city name
 */
router.get('/reverse', async (c) => {
    const lat = parseFloat(c.req.query('lat') || '0');
    const lng = parseFloat(c.req.query('lng') || '0');

    if (!lat || !lng || lat === 0 || lng === 0) {
        return c.json({ 
            error: 'Invalid coordinates' 
        }, 400);
    }

    try {
        const googlePlacesKey = await getApiKey('google_places');
        
        if (!googlePlacesKey) {
            console.error('❌ Google Places API key not found');
            return c.json({ 
                error: 'Google Places API not configured'
            }, 500);
        }

        // Use Google Geocoding API for reverse geocoding
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googlePlacesKey}`;
        
        const geocodeResponse = await axios.get(geocodeUrl);
        const geocodeData = geocodeResponse.data;

        if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
            return c.json({ 
                error: 'No results found',
                status: geocodeData.status
            }, 404);
        }

        const result = geocodeData.results[0];
        const addressComponents = result.address_components || [];
        
        let cityName = '';
        let country = '';
        let region = '';
        let timezone = 'UTC';

        // Extract city name (prefer locality, fallback to district)
        for (const component of addressComponents) {
            if (component.types.includes('locality')) {
                cityName = component.long_name;
            } else if (!cityName && component.types.includes('administrative_area_level_2')) {
                // Remove "District" suffix if present
                const districtName = component.long_name.replace(/\s+District$/i, '');
                cityName = districtName;
            } else if (!cityName && component.types.includes('sublocality')) {
                cityName = component.long_name;
            }
            if (component.types.includes('country')) {
                country = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
                region = component.short_name;
            }
        }

        // If no city name found, use formatted address or place name
        if (!cityName) {
            cityName = result.formatted_address.split(',')[0] || result.name || 'Unknown';
        }

        // Get timezone (with fallback)
        const timestamp = Math.floor(Date.now() / 1000);
        const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${googlePlacesKey}`;
        
        // Start with fallback estimate
        timezone = estimateTimezone(lng, country);
        
        try {
            const timezoneResponse = await axios.get(timezoneUrl);
            const timezoneData = timezoneResponse.data;
            if (timezoneData.status === 'OK') {
                timezone = timezoneData.timeZoneId;
            }
        } catch (error) {
            console.warn(`Timezone API failed, using fallback: ${timezone}`);
        }

        return c.json({
            name: cityName,
            country,
            region,
            timezone,
            latitude: lat,
            longitude: lng,
            formatted_address: result.formatted_address,
        });

    } catch (error: any) {
        console.error('Reverse geocoding error:', error.message);
        return c.json({ 
            error: 'Reverse geocoding failed'
        }, 500);
    }
});

export default router;
