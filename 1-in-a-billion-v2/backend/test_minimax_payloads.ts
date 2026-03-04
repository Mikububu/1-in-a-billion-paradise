import axios from 'axios';
import { env } from './src/config/env';
import { apiKeys } from './src/services/apiKeysHelper';

async function testTimbre(method: string, payloadOverrides: any) {
    console.log(`\nTesting: ${method}`);
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;

        let payload = {
            model: 'speech-01-turbo',
            text: 'Hallo, ich bin David und dies ist ein Test auf Deutsch.',
            voice_setting: {
                voice_id: 'audiobook_male_1',
                speed: 1.0,
                vol: 1.0
            },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
            ...payloadOverrides
        };

        const res = await axios.post('https://api.minimax.io/v1/t2a_v2', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        if (res.data.base_resp?.status_code === 0) {
            console.log(`✅ Success! Audio length: ${res.data.data.audio.length}`);
        } else {
            console.log(`❌ Failed: ${res.data.base_resp?.status_msg}`);
        }
    } catch (e: any) {
        console.error("❌ Error:", e.response?.data || e.message);
    }
}

async function run() {
    const fileId = "373036513739035"; // David reference
    const DavidText = `My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water.`; // shortened

    // 1. Just clone_prompt in root (what we do now in t2a_async_v2)
    await testTimbre("clone_prompt.prompt_audio in root", {
        clone_prompt: { prompt_audio: fileId }
    });

    // 2. clone_prompt in root with prompt_text (transcript)
    await testTimbre("clone_prompt.prompt_audio + prompt_text in root", {
        clone_prompt: { prompt_audio: fileId, prompt_text: DavidText }
    });

    // 3. timber_weights in voice_setting
    await testTimbre("timber_weights with voice_id", {
        voice_setting: {
            voice_id: 'audiobook_male_1',
            speed: 1.0,
            vol: 1.0,
            timber_weights: [
                { voice_id: 'audiobook_male_1', weight: 1 },
                { voice_id: fileId, weight: 1 } // testing if fileId can be passed here
            ]
        }
    });

}
run();
