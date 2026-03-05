import axios from 'axios';

const key = 'sk-api-pQhWTy35aIo9ET9UfKAKWfiftzwVN7M12Amj-YqmT6UWGxzokSs5Dy6vMO2FGgSkU7laijedfow0bE72faVg1zWrRBUUkORKbyS2IQF9i27hf5qmfIkXJYk';

async function poll(taskId: string) {
    let pollCount = 0;
    while (true) {
        const fetchRes = await axios.get(`https://api.minimax.io/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const status = fetchRes.data.status;
        console.log(`Task ${taskId} status: ${status}`);
        if (status === 'Success' || status === 'Fail') {
            console.log(JSON.stringify(fetchRes.data, null, 2));
            break;
        }
        await new Promise(r => setTimeout(r, 2000));
        pollCount++;
        if (pollCount > 10) break;
    }
}

async function test() {
    try {
        console.log("Testing Japanese TTS with pause indicator...");
        const payload = {
            model: 'speech-02-turbo',
            text: 'イントロダクション\n\n………………………………\n\nこんにちは世界',
            voice_setting: { voice_id: 'Japanese_IntellectualSenior', speed: 1.0, vol: 1.0 },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
            language_boost: 'ja',
        };
        const submitRes = await axios.post('https://api.minimax.io/v1/t2a_async_v2', payload, {
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
        });

        await poll(submitRes.data.task_id);

    } catch (e) {
        console.error("Error:", e.message, e.response?.data);
    }
}
test();
