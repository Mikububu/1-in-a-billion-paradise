import { llm } from '../llm';

/**
 * Uses a fast LLM to find untranslatable English esoteric/astrological terms
 * and dynamically respell them phonetically according to the target language's
 * pronunciation rules. This ensures a foreign TTS voice reads them correctly.
 */
export async function phoneticizeTextForTTS(text: string, language: string): Promise<string> {
    if (!text || language === 'en') return text;

    const systemPrompt = `You are a phonetic transliteration assistant for a Text-to-Speech (TTS) engine.
The following text is written in English, but it will be read aloud by a ${language} TTS voice.
Extract any English spiritual, astrological, or system-specific proper nouns (e.g., "Human Design", "Gene Keys", "Manifesting Generator", "Incarnation Cross").
For each extracted term, provide a phonetic respelling using ${language} pronunciation rules so that a naive ${language} TTS voice will pronounce the English term correctly.
Do NOT translate the words into ${language} (e.g. do not translate "Human Design" to its literal meaning), just spell the English word phonetically for a ${language} reader.
Return ONLY a valid JSON object mapping the original term to the phonetic spelling. If no terms are found, return {}.

Example output for German:
{
  "Gene Keys": "Dschien Kies",
  "Human Design": "Hiumän Disein"
}
`;

    try {
        const rawContent = await llm.generate(
            `${systemPrompt}\n\nTEXT:\n${text}`,
            'phoneticizer',
            { temperature: 0.1, maxTokens: 800 } // Keep it strict and fast
        );

        const normalized = rawContent.replace(/```json|```/g, '').trim();
        console.log("Phoneticizer Output Normal:", normalized);
        const dictionary = JSON.parse(normalized);
        console.log("Phoneticizer Dictionary:", dictionary);

        // Apply the replacements to the text
        let processedText = text;
        for (const [original, phonetic] of Object.entries(dictionary)) {
            if (typeof original === 'string' && typeof phonetic === 'string' && original.trim() !== '') {
                // Create a case-insensitive regex for the term, matching whole words where possible
                // We escape regex chars in the original term just in case
                const escaped = original.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
                const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
                processedText = processedText.replace(regex, phonetic);
            }
        }

        return processedText;

    } catch (error) {
        console.error(`[Phoneticizer] Failed to generate or parse phonetic dictionary for ${language}. Falling back to original text.`, error);
        return text; // Fallback to original text if LLM fails
    }
}
