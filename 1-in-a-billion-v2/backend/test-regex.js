const text = "This is a reading about Gene Keys and Human Design. How exciting!";
const original = "Gene Keys";
// Correct escape:
const escaped = original.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const regex = new RegExp(`\\b${escaped}\\b`, "gi");
console.log("Regex:", regex);
console.log("Result:", text.replace(regex, "Dschien Kies"));
