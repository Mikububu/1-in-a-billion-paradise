import axios from 'axios';
import { env } from './src/config/env';
import { apiKeys } from './src/services/apiKeysHelper';
import fs from 'fs';

async function testTimbre(method: string, payloadOverrides: any, filename: string) {
    console.log(`\nTesting: ${method}`);
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;

        let payload: any = {
            model: 'speech-01-turbo',
            text: 'I am David, and this is a test to see if I sound like myself.',
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
        };

        payload = { ...payload, ...payloadOverrides };

        const res = await axios.post('https://api.minimax.io/v1/t2a_v2', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        if (res.data.base_resp?.status_code === 0) {
            const hexData = res.data.data.audio;
            const buffer = Buffer.from(hexData, 'hex');
            fs.writeFileSync(filename, buffer);
            console.log(`✅ Success! Audio saved to ${filename} (size: ${buffer.length} bytes)`);
        } else {
            console.log(`❌ Failed: ${res.data.base_resp?.status_msg}`);
        }
    } catch (e: any) {
        console.error("❌ Error:", e.response?.data || e.message);
    }
}

async function run() {
    const fileId = "373036513739035"; // David reference

    // 1. Timber weights: 90% David, 10% Base
    await testTimbre("Timber Weights: 90% David", {
        voice_setting: {
            voice_id: 'English_expressive_narrator',
            speed: 1.0,
            vol: 1.0,
            timber_weights: [
                { voice_id: 'English_expressive_narrator', weight: 1 },
                { voice_id: fileId, weight: 9 }
            ]
        },
        clone_prompt: { prompt_audio: fileId }
    }, "timber_90_david.mp3");

    // 2. Timber weights: exclusively David? (weight 1 for David, 0 for Base)
    await testTimbre("Timber Weights: 100% David", {
        voice_setting: {
            voice_id: 'English_expressive_narrator',
            speed: 1.0,
            vol: 1.0,
            timber_weights: [
                // { voice_id: 'English_expressive_narrator', weight: 0 },
                { voice_id: fileId, weight: 1 }
            ]
        },
        clone_prompt: { prompt_audio: fileId }
    }, "timber_100_david.mp3");
}
run();
