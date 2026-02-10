/**
 * Test if "Wichian Buri" can be found in Google Places search
 */

import axios from 'axios';
import { config } from 'dotenv';
import { join } from 'path';
import { getApiKey } from './src/services/apiKeys';

config({ path: join(__dirname, '.env') });

async function testWichianBuriSearch() {
  try {
    const googlePlacesKey = await getApiKey('google_places');
    
    if (!googlePlacesKey) {
      console.error('❌ Google Places API key not found');
      process.exit(1);
    }

    const coordinates = { lat: 15.656534, lng: 101.038433 };

    console.log('🔍 Testing reverse geocoding for coordinates:', coordinates);
    console.log('   Expected city: Wichian Buri\n');

    // Test 1: Reverse geocoding (coordinates to address)
    console.log('1️⃣ Testing Reverse Geocoding...');
    const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${googlePlacesKey}`;
    
    const reverseResponse = await axios.get(reverseGeocodeUrl);
    const reverseData = reverseResponse.data;

    if (reverseData.status === 'OK' && reverseData.results && reverseData.results.length > 0) {
      console.log('✅ Reverse geocoding successful:');
      const result = reverseData.results[0];
      console.log('   Formatted address:', result.formatted_address);
      
      // Extract city from address components
      const addressComponents = result.address_components || [];
      let cityName = '';
      let country = '';
      
      for (const component of addressComponents) {
        if (component.types.includes('locality')) {
          cityName = component.long_name;
          console.log('   City (locality):', cityName);
        }
        if (component.types.includes('administrative_area_level_2')) {
          console.log('   District:', component.long_name);
        }
        if (component.types.includes('administrative_area_level_1')) {
          console.log('   Province:', component.long_name);
        }
        if (component.types.includes('country')) {
          country = component.long_name;
          console.log('   Country:', country);
        }
      }
      
      if (!cityName) {
        console.log('   ⚠️  No "locality" found, checking other types...');
        for (const component of addressComponents) {
          console.log(`   - ${component.types.join(', ')}: ${component.long_name}`);
        }
      }
    } else {
      console.log('❌ Reverse geocoding failed:', reverseData.status);
    }

    console.log('\n2️⃣ Testing City Search with "Wichian Buri"...');
    // Test 2: Search for "Wichian Buri"
    const searchQueries = [
      'Wichian Buri',
      'Wichian',
      'Wichian Buri Thailand',
      'วิเชียรบุรี', // Thai name
    ];

    for (const query of searchQueries) {
      console.log(`\n   Searching: "${query}"`);
      
      // Current implementation (cities only)
      const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${googlePlacesKey}`;
      const autocompleteResponse = await axios.get(autocompleteUrl);
      const autocompleteData = autocompleteResponse.data;

      if (autocompleteData.status === 'OK' && autocompleteData.predictions) {
        console.log(`   ✅ Found ${autocompleteData.predictions.length} result(s):`);
        autocompleteData.predictions.slice(0, 3).forEach((pred: any) => {
          console.log(`      - ${pred.description}`);
        });
      } else {
        console.log(`   ❌ No results (status: ${autocompleteData.status})`);
      }

      // Test without cities restriction
      const autocompleteUrlNoRestriction = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googlePlacesKey}`;
      const autocompleteResponse2 = await axios.get(autocompleteUrlNoRestriction);
      const autocompleteData2 = autocompleteResponse2.data;

      if (autocompleteData2.status === 'OK' && autocompleteData2.predictions) {
        const cityResults = autocompleteData2.predictions.filter((p: any) => 
          p.types.includes('locality') || p.types.includes('administrative_area_level_2')
        );
        if (cityResults.length > 0) {
          console.log(`   ✅ Found ${cityResults.length} city/town result(s) without restriction:`);
          cityResults.slice(0, 3).forEach((pred: any) => {
            console.log(`      - ${pred.description} (types: ${pred.types.join(', ')})`);
          });
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testWichianBuriSearch().catch(console.error);
