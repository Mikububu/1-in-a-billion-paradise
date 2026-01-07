import axios from 'axios';
import * as lamejs from 'lamejs';
import { VedicMatchResult, DoshaResult } from './vedic_ashtakoota.vectorized.engine';

// Types for Profiles
interface NarrationProfile {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/audio/speech';
const VOICE_ID = 'onyx';
const MODEL_ID = 'tts-1';
const SAMPLE_RATE = 24000;

export class VedicAudioGenerator {

    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    generateNarrationScript(match: VedicMatchResult, personA: NarrationProfile, personB: NarrationProfile): {
        cover: string;
        intro: string;
        birthData: string;
        ashtakoota: string;
        dosha: string;
        dasha: string;
        conclusion: string;
    } {
        const fmtScore = (n: number, max: number) => `${this.numberToWords(n)} out of ${this.numberToWords(max)}`;

        const cover = `Vedic Compatibility Report. \n\n${personA.name} and ${personB.name}.`;
        const intro = `This audio reading analyzes the Jyotish compatibility using Ashtakoota, Dosha, and Dasha timing.`;

        const birthData = `Profile One: ${personA.name}. Born ${personA.birthDate} at ${personA.birthTime} in ${personA.birthPlace}. \n\n` +
            `Profile Two: ${personB.name}. Born ${personB.birthDate} at ${personB.birthTime} in ${personB.birthPlace}.`;

        const ashtakoota = `Section One: The Eightfold Compatibility. \n\n` +
            `Varna: ${fmtScore(match.guna_breakdown.varna, 1)}. \n` +
            `Vashya: ${fmtScore(match.guna_breakdown.vashya, 2)}. \n` +
            `Tara: ${fmtScore(match.guna_breakdown.tara, 3)}. \n` +
            `Yoni: ${fmtScore(match.guna_breakdown.yoni, 4)}. \n` +
            `Graha Maitri: ${fmtScore(match.guna_breakdown.graha_maitri, 5)}. \n` +
            `Gana: ${fmtScore(match.guna_breakdown.gana, 6)}. \n` +
            `Bhakoot: ${fmtScore(match.guna_breakdown.bhakoot, 7)}. \n` +
            `Nadi: ${fmtScore(match.guna_breakdown.nadi, 8)}. \n\n` +
            `Total Ashtakoota Score: ${fmtScore(match.guna_total, 36)}.`;

        const manglikText = match.dosha.manglik === 'active' ? "Manglik Dosha is active." :
            match.dosha.manglik === 'cancelled' ? "Manglik Dosha is cancelled." :
                "Manglik Dosha is not present.";

        const nadiText = match.dosha.nadi ? "Nadi Dosha is active." : "Nadi Dosha is not active.";
        const bhakootText = match.dosha.bhakoot ? "Bhakoot Dosha is active." : "Bhakoot Dosha is not active.";

        const dosha = `Section Two: Dosha Analysis. \n\n${manglikText} \n${nadiText} \n${bhakootText}`;

        const dashaText = match.dasha.phase_relation === 'same' ? "Planetary periods are synchronized." :
            match.dasha.phase_relation === 'supportive' ? "Planetary periods are supportive." :
                "Planetary periods are conflicting.";
        const dasha = `Section Three: Timing. \n\n${dashaText}`;

        const conclusion = `Conclusion. The final verdict is: ${match.verdict_band}.`;

        return { cover, intro, birthData, ashtakoota, dosha, dasha, conclusion };
    }

    async synthesizeSegment(text: string): Promise<Int16Array> {
        if (!text.trim()) return new Int16Array(0);

        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: MODEL_ID,
                input: text,
                voice: VOICE_ID,
                response_format: 'pcm',
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
            }
        );

        const buffer = response.data;
        return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    }

    generateSilence(durationSeconds: number): Int16Array {
        const numSamples = Math.floor(durationSeconds * SAMPLE_RATE);
        return new Int16Array(numSamples);
    }

    async createAudiobook(match: VedicMatchResult, profiles: { a: NarrationProfile, b: NarrationProfile }): Promise<Int8Array> {

        const script = this.generateNarrationScript(match, profiles.a, profiles.b);

        const sequence = [
            { text: script.cover, pauseAfter: 1.4 },
            { text: script.intro, pauseAfter: 1.4 },
            { text: script.birthData, pauseAfter: 0.8 },
            { text: script.ashtakoota, pauseAfter: 0.8 },
            { text: script.dosha, pauseAfter: 1.0 },
            { text: script.dasha, pauseAfter: 0.5 },
            { text: script.conclusion, pauseAfter: 0.0 }
        ];

        const audioChunks: Int16Array[] = [];
        let totalSamples = 0;

        for (const seq of sequence) {
            console.log(`Synthesizing: ${seq.text.substring(0, 20)}...`);
            const pcm = await this.synthesizeSegment(seq.text);
            audioChunks.push(pcm);
            totalSamples += pcm.length;

            if (seq.pauseAfter > 0) {
                const silence = this.generateSilence(seq.pauseAfter);
                audioChunks.push(silence);
                totalSamples += silence.length;
            }
        }

        const finalPcm = new Int16Array(totalSamples);
        let offset = 0;
        for (const chunk of audioChunks) {
            finalPcm.set(chunk, offset);
            offset += chunk.length;
        }

        const mp3encoder = new lamejs.Mp3Encoder(1, SAMPLE_RATE, 128);
        const mp3Data: Int8Array[] = [];

        const sampleBlockSize = 1152;
        for (let i = 0; i < finalPcm.length; i += sampleBlockSize) {
            const chunk = finalPcm.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        const endBuf = mp3encoder.flush();
        if (endBuf.length > 0) {
            mp3Data.push(endBuf);
        }

        const totalMp3Len = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
        const finalMp3 = new Int8Array(totalMp3Len);
        let mp3Offset = 0;
        for (const buf of mp3Data) {
            finalMp3.set(buf, mp3Offset);
            mp3Offset += buf.length;
        }

        return finalMp3;
    }

    private numberToWords(n: number): string {
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
            'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        if (n < 20) return words[n];
        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 ? '-' + words[n % 10] : '');
        }
        return n.toString();
    }
}
