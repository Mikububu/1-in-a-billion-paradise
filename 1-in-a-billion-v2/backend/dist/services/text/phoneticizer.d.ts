/**
 * Uses a fast LLM to find untranslatable English esoteric/astrological terms
 * and dynamically respell them phonetically according to the target language's
 * pronunciation rules. This ensures a foreign TTS voice reads them correctly.
 */
export declare function phoneticizeTextForTTS(text: string, language: string): Promise<string>;
//# sourceMappingURL=phoneticizer.d.ts.map