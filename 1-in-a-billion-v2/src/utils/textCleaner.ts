export function cleanTextForAudio(text: string): string {
    if (!text) return text;
    // Remove markdown bold/italic asterisks
    let cleaned = text.replace(/\*/g, '');
    // Remove underscores
    cleaned = cleaned.replace(/_/g, '');
    // Remove markdown headers
    cleaned = cleaned.replace(/#/g, '');
    // Remove brackets
    cleaned = cleaned.replace(/\[|\]/g, '');
    // Remove multiple newlines and spaces
    cleaned = cleaned.replace(/\n+/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    return cleaned.trim();
}
