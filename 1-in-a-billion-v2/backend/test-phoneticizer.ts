import { phoneticizeTextForTTS } from './src/services/text/phoneticizer';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("Starting test...");
    const text = 'This is a reading about Gene Keys and Human Design. How exciting!';
    const result = await phoneticizeTextForTTS(text, 'de');
    console.log("Original:", text);
    console.log("Phoneticized:", result);
}
main().catch(console.error);
