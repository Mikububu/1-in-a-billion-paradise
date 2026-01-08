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

        // Use Google Places Autocomplete API (types=geocode to prefer cities)
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${googlePlacesKey}`;
        
        const autocompleteResponse = await axios.get(autocompleteUrl);
        const autocompleteData = autocompleteResponse.data;

        if (autocompleteData.status !== 'OK' || !autocompleteData.predictions) {
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
                    if (component.types.includes('locality')) {
                        cityName = component.long_name;
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

export default router;
