import { cleanupTextForTTS } from './src/utils/textCleanup';

const text = "Rätsel verborgen, das sich nur durch ihre Begegnung entschlüsselt. Victor trägt den Genschlüssel 3! ¡Hola! ¿Qué tal? Ça va? 谢谢 😊";
const cleaned = cleanupTextForTTS(text);
console.log("Original:", text);
console.log("Cleaned: ", cleaned);
