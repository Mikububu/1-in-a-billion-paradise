import { getMinimaxSequenceForUrl, generateMinimaxAsync } from './src/services/minimaxTts';

async function test() {
    console.log("Testing Minimax Upload and Clone for David...");
    try {
        const url = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
        console.log("1. Uploading David's voice:", url);
        const fileId = await getMinimaxSequenceForUrl(url, `david_reference.wav`);
        console.log("✅ File uploaded successfully. File ID:", fileId);

        console.log("2. Testing generation with German base voice...");
        const result = await generateMinimaxAsync("Hallo, ich bin David und dies ist ein Test auf Deutsch.", "German_FriendlyMan", fileId, 1.0, 1.0);
        console.log("✅ Generation successful! Got MP3 buffer of size:", result.length);
    } catch (e: any) {
        console.error("❌ Test failed:", e.message || e);
        if (e.response && e.response.data) {
            console.error("Response data:", e.response.data);
        }
    }
}
test();
