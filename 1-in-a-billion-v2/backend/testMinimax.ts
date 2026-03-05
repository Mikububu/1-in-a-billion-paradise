import axios from 'axios';
import FormData from 'form-data';

const key = 'sk-api-pQhWTy35aIo9ET9UfKAKWfiftzwVN7M12Amj-YqmT6UWGxzokSs5Dy6vMO2FGgSkU7laijedfow0bE72faVg1zWrRBUUkORKbyS2IQF9i27hf5qmfIkXJYk';

async function poll(taskId: string) {
    let pollCount = 0;
    while (true) {
        const fetchRes = await axios.get(`https://api.minimax.io/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
            headers: { 'Authorization': `Bearer ${key}` },
            validateStatus: () => true
        });
        const status = fetchRes.data.status;
        console.log(`Task ${taskId} status: ${status}`);
        if (status === 'Success' || status === 'Fail') {
            console.log(JSON.stringify(fetchRes.data, null, 2));
            break;
        }
        await new Promise(r => setTimeout(r, 3000));
        pollCount++;
        if (pollCount > 10) break;
    }
}

async function test() {
    try {
        const dummyWav = Buffer.alloc(1024);
        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + 1024, 4);
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20);
        wavHeader.writeUInt16LE(1, 22);
        wavHeader.writeUInt32LE(44100, 24);
        wavHeader.writeUInt32LE(44100 * 2, 28);
        wavHeader.writeUInt16LE(2, 32);
        wavHeader.writeUInt16LE(16, 34);
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(1024, 40);

        const validWav = Buffer.concat([wavHeader, dummyWav]);
        const form = new FormData();
        form.append('file', validWav, { filename: 'test.wav', contentType: 'audio/wav' });
        form.append('purpose', 'voice_clone');

        const upRes = await axios.post('https://api.minimax.io/v1/files/upload', form, {
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${key}` }
        });
        const fileId = upRes.data.file?.file_id;

        console.log("Testing Japanese TTS with Clone (speech-02-turbo)...");
        const payload1 = {
            model: 'speech-02-turbo',
            text: 'こんにちは',
            voice_setting: {
                voice_id: 'Japanese_GentleButler', speed: 1.0, vol: 1.0,
                timber_weights: [{ voice_id: 'Japanese_GentleButler', weight: 1 }, { voice_id: String(fileId), weight: 15 }]
            },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
            language_boost: 'ja',
            clone_prompt: { prompt_audio: String(fileId) }
        };
        const submitRes1 = await axios.post('https://api.minimax.io/v1/t2a_async_v2', payload1, {
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
        });

        await poll(submitRes1.data.task_id);

    } catch (e) {
        console.error("Error:", e.message, e.response?.data);
    }
}
test();
