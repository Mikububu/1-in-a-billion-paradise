import { llm } from './src/services/llm';

const sampleText = `
Michael is a Manifesting Generator in Human Design, deeply influenced by his 3/5 Profile and the Incarnation Cross of the Sleeping Phoenix. 
In Gene Keys, his Life's Work is governed by the 55th Gene Key, moving from Victimhood to Freedom.
`;

const prompt = `
You are a phonetic transliteration assistant for a Text-to-Speech (TTS) engine.
The following text is written in English, but it will be read aloud by a German TTS voice.
Extract any English spiritual, astrological, or system-specific proper nouns (e.g., "Human Design", "Gene Keys", "Manifesting Generator", "Incarnation Cross").
For each extracted term, provide a phonetic respelling using German pronunciation rules so that a naive German TTS voice will pronounce the English term correctly.
Do NOT translate the words into German (e.g. do not say "Menschendesign"), just spell the English word phonetically for a German reader.
Return ONLY a valid JSON object mapping the original term to the phonetic spelling.

Example output:
{
  "Gene Keys": "Dschien Kies",
  "Human Design": "Hiumän Disein"
}

TEXT:
${sampleText}
`;

(async () => {
  try {
    const res = await llm.generate(prompt, 'test-phonetic', { temperature: 0.1 });
    console.log(res);
  } catch(e) {
    console.error(e);
  }
})();
