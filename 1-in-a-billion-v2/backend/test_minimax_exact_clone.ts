import axios from 'axios';
import { env } from './src/config/env';
import { apiKeys } from './src/services/apiKeysHelper';
import fs from 'fs';

async function testTimbre(method: string, payloadOverrides: any, filename: string) {
    console.log(`\nTesting: ${method}`);
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;

        // Base payload
        let payload: any = {
            model: 'speech-01-turbo',
            text: 'I am David, and this is a test to see if I sound like myself.',
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
        };

        // Merge overrides
        payload = { ...payload, ...payloadOverrides };

        const res = await axios.post('https://api.minimax.io/v1/t2a_v2', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        if (res.data.base_resp?.status_code === 0) {
            const hexData = res.data.data.audio;
            // hex to buffer
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
    const DavidText = `My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water.`;

    // 1. Current prod implementation (expressive narrator + clone_prompt without text)
    await testTimbre("Prod approach (Expressive Narrator + clone)", {
        voice_setting: { voice_id: 'English_expressive_narrator', speed: 1.0, vol: 1.0 },
        clone_prompt: { prompt_audio: fileId }
    }, "1_prod_approach.mp3");

    // 2. Clone prompt with transcript
    await testTimbre("Clone with transcript", {
        voice_setting: { voice_id: 'English_expressive_narrator', speed: 1.0, vol: 1.0 },
        clone_prompt: { prompt_audio: fileId, prompt_text: DavidText }
    }, "2_clone_with_transcript.mp3");

    // 3. Omitting voice_id completely (leaving only clone_prompt)
    await testTimbre("Omit voice_id entirely", {
        clone_prompt: { prompt_audio: fileId }
    }, "3_omit_voice_id.mp3");

    // 4. Using empty string for voice_id
    await testTimbre("Empty voice_id", {
        voice_setting: { voice_id: '', speed: 1.0, vol: 1.0 },
        clone_prompt: { prompt_audio: fileId }
    }, "4_empty_voice_id.mp3");
}
run();
