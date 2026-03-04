import axios from 'axios';

const API_KEY = 'sk-api-xWT7nhj_tK-5XckrK03LCM_CSAlQuzODSgicp0RvVuZc6rtNpjAaT3FhEHvgHg2kDTEJ1c-XLSZO86DWa6bUtvo-IKqIuXDG_dzYLuarZhlm5yo9M7cS7P0'; // from addMinimaxKey.ts

async function testVoice(voiceId: string) {
    try {
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
        const submitRes = await axios.post('https://api.minimax.chat/v1/t2a_v2', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        if (submitRes.data.base_resp?.status_code === 0) {
            console.log(`✅ ${voiceId} - VALID`);
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
    const candidates = [
        'German_FriendlyMan', 'German_FriendlyGirl', 'German_FriendlyWoman', 'German_CasualWoman', 'German_Female', 'Female-German',
        'Spanish_FriendlyNeighbor', 'Spanish_FriendlyGirl', 'Spanish_CasualWoman', 'Spanish_FriendlyWoman',
        'Japanese_FriendlyGirl', 'Japanese_FriendlyMan', 'Japanese_FriendlyNeighbor',
        'Korean_SweetGirl', 'Korean_FriendlyMan',
        'Portuguese_FriendlyNeighbor', 'Portuguese_FriendlyGirl', 'Portuguese_FriendlyWoman',
        'Italian_Narrator', 'Italian_FriendlyGirl', 'Italian_FriendlyWoman',
        'French_CasualMan', 'French_FriendlyGirl', 'French_CasualWoman', 'French_FriendlyWoman'
    ];
    for (const c of candidates) {
        await testVoice(c);
        await new Promise(r => setTimeout(r, 1000));
    }
}
run();
