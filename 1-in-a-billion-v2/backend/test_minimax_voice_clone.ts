import axios from 'axios';
import { apiKeys } from './src/services/apiKeysHelper';
import { env } from './src/config/env';

async function testClone() {
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        const fileId = "373036513739035"; // from previous David upload

        const payload = {
            voice_id: "custom_david_001",
            clone_prompt: {
                prompt_audio: fileId
            }
        };

        console.log("Calling voice_clone endpoint...");
        const res = await axios.post('https://api.minimax.io/v1/voice_clone', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        console.log("Success:", JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.error("Error:", JSON.stringify(e.response?.data || e.message, null, 2));
    }
}
testClone();
