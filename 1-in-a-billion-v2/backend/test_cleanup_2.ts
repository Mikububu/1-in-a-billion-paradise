const text = "Rätsel verborgen, das sich nur durch ihre Begegnung entschlüsselt. Victor trägt den Genschlüssel 3! ¡Hola! ¿Qué tal? Ça va? 谢谢 😊 ♈ ♉";

let cleaned = text.replace(/[^\p{L}\p{N}\p{M}\x20-\x7E\n\r\t.,;:!?'"()\[\]{}]/gu, ' ');

// Let's also remove emojis specifically, although the original script did it later.
// original script had:
cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // Miscellaneous Symbols and Pictographs
cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Miscellaneous Symbols
cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats

console.log("Original:", text);
console.log("Cleaned: ", cleaned);
