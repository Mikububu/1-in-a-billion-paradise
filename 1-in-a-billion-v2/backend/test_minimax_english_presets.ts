import axios from 'axios';
import { apiKeys } from './src/services/apiKeysHelper';
import { env } from './src/config/env';

async function testVoice(voiceId: string) {
    try {
        const API_KEY = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        const payload = {
            model: 'speech-01-turbo',
            text: 'Test',
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
            console.log(`✅ ${voiceId} - VALID`);
            return true;
        } else {
            console.log(`❌ ${voiceId} - INVALID`);
            return false;
        }
    } catch (error: any) {
        return false;
    }
}

async function run() {
    const candidates = [
        'English_CalmWoman',
        'English_UpsetGirl',
        'English_Graceful_Lady',
        'English_PlayfulGirl',
        'English_LovelyGirl',
        'English_Wiselady',
        'English_CaptivatingStoryteller',
        'English_SentimentalLady',
        'English_ImposingManner',
        'Wise_Woman',
        'English_Soft-spokenGirl',
        'English_ConfidentWoman'
    ];
    for (const c of candidates) {
        await testVoice(c);
        await new Promise(r => setTimeout(r, 600));
    }
}
run();
