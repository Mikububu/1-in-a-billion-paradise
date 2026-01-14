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

const router = new Hono();

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
 * GET /search?q=<query>
 * Search for cities using Google Places API
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

        // Use Google Places Autocomplete API
        // Search without strict (cities) restriction to find towns, communes, districts
        // This finds places like Meyrin (Switzerland), Wichian Buri (Thailand), etc.
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(regions)&key=${googlePlacesKey}`;
        
        let autocompleteResponse = await axios.get(autocompleteUrl);
        let autocompleteData = autocompleteResponse.data;

        // Filter to only include cities, towns, districts, localities
        if (autocompleteData.status === 'OK' && autocompleteData.predictions) {
            autocompleteData.predictions = autocompleteData.predictions.filter((pred: any) => {
                const types = pred.types || [];
                // Accept: locality, sublocality, town, city, district, commune
                return types.includes('locality') || 
                       types.includes('sublocality') ||
                       types.includes('administrative_area_level_2') || 
                       types.includes('administrative_area_level_3') ||
                       types.includes('administrative_area_level_4') ||
                       types.includes('colloquial_area') ||
                       (types.includes('geocode') && !types.includes('country'));
            });
        }

        if (autocompleteData.status !== 'OK' || !autocompleteData.predictions || autocompleteData.predictions.length === 0) {
            console.warn('Google Places Autocomplete returned no results:', autocompleteData.status);
            return c.json({ cities: [] });
        }

        // Get detailed info for each place (to get coordinates and timezone)
        const cities: CityResult[] = [];

        for (const prediction of autocompleteData.predictions.slice(0, 6)) {
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
                const addressComponents = result.address_components || [];
                let cityName = result.name;
                let country = '';
                let region = '';

                for (const component of addressComponents) {
                    if (component.types.includes('country')) {
                        country = component.long_name;
                    }
                    if (component.types.includes('administrative_area_level_1')) {
                        region = component.short_name;
                    }
                    // Prefer locality (city), but fallback to district if no locality
                    if (component.types.includes('locality')) {
                        cityName = component.long_name;
                    } else if (!cityName || cityName === result.name) {
                        // If no locality found, use district or sublocality
                        if (component.types.includes('administrative_area_level_2')) {
                            // Remove "District" suffix if present (e.g., "Wichian Buri District" -> "Wichian Buri")
                            cityName = component.long_name.replace(/\s+District$/i, '');
                        } else if (component.types.includes('sublocality')) {
                            cityName = component.long_name;
                        }
                    }
                }

                // Get timezone using Google Timezone API
                const timestamp = Math.floor(Date.now() / 1000);
                const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${location.lat},${location.lng}&timestamp=${timestamp}&key=${googlePlacesKey}`;
                
                const timezoneResponse = await axios.get(timezoneUrl);
                const timezoneData = timezoneResponse.data;

                const timezone = timezoneData.status === 'OK' 
                    ? timezoneData.timeZoneId 
                    : 'UTC'; // Fallback

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

        // Get timezone
        const timestamp = Math.floor(Date.now() / 1000);
        const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${googlePlacesKey}`;
        
        try {
            const timezoneResponse = await axios.get(timezoneUrl);
            const timezoneData = timezoneResponse.data;
            if (timezoneData.status === 'OK') {
                timezone = timezoneData.timeZoneId;
            }
        } catch (error) {
            console.warn('Timezone API failed, using UTC');
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
