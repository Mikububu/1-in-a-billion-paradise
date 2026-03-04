import axios from 'axios';
import { apiKeys } from './src/services/apiKeysHelper';
import { env } from './src/config/env';

async function testVoice(voiceId: string, text: string) {
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        const payload = {
            model: 'speech-01-turbo',
            text: text,
            voice_setting: {
                voice_id: voiceId,
                speed: 1.0,
                vol: 1.0
            },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 }
        };
        const submitRes = await axios.post('https://api.minimax.io/v1/t2a_v2', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        if (submitRes.data.base_resp?.status_code === 0) {
            console.log(`✅ ${voiceId} - VALID (Text: ${text})`);
            return true;
        } else {
            console.log(`❌ ${voiceId} - INVALID (${submitRes.data.base_resp?.status_msg})`);
            return false;
        }
    } catch (error: any) {
        console.log(`❌ ${voiceId} - ERROR (${error.response?.data?.base_resp?.status_msg || error.message})`);
        return false;
    }
}

async function run() {
    await testVoice('female-anna', 'Hallo, ich bin Anna und dies ist ein Test auf Deutsch.');
    await testVoice('male-david', 'Bonjour, je suis David et c\'est un test en français.');
    await testVoice('female-mary', 'Hola, soy Mary y esto es una prueba en español.');
}
run();
