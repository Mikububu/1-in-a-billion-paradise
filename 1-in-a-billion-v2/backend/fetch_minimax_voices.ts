import axios from 'axios';
import { apiKeys } from './src/services/apiKeysHelper';
import { env } from './src/config/env';

async function fetchVoices() {
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        const submitRes = await axios.get('https://api.minimax.io/v1/voices', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log("Response:", JSON.stringify(submitRes.data, null, 2));
    } catch (error: any) {
        console.log(`❌ ERROR fetching voices.`, error.response?.data || error.message);
    }
}

fetchVoices();
