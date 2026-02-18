import fs from 'node:fs';
import path from 'node:path';
import { composePromptFromJobStartPayload } from '../promptEngine/fromJobPayload';
import { llmPaid } from '../services/llm';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';

function tsTag(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function resolveDefaultMediaOutDir(projectRoot: string): string {
  if (process.env.MEDIA_OUT_DIR?.trim()) return process.env.MEDIA_OUT_DIR.trim();
  const desktop = process.env.HOME ? path.join(process.env.HOME, 'Desktop') : '';
  if (desktop && fs.existsSync(desktop)) {
    return path.join(desktop, '1-in-a-billion-media');
  }
  return path.join(projectRoot, 'runtime', 'media');
}

function resolvePortraitsDir(projectRoot: string): string {
  if (process.env.PORTRAITS_DIR?.trim()) return process.env.PORTRAITS_DIR.trim();
  const desktop = process.env.HOME ? path.join(process.env.HOME, 'Desktop') : '';
  const desktopPortraits = desktop ? path.join(desktop, 'Portraits to upload') : '';
  if (desktopPortraits && fs.existsSync(desktopPortraits)) {
    return desktopPortraits;
  }
  return path.join(projectRoot, 'runtime', 'portraits-to-upload');
}

async function main() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const outDir = resolveDefaultMediaOutDir(projectRoot);
  const portraitsDir = resolvePortraitsDir(projectRoot);
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    type: 'synastry',
    systems: ['kabbalah'],
    person1: {
      name: 'Michael',
      birthDate: '1968-08-23',
      birthTime: '13:45',
      timezone: 'Europe/Vienna',
      latitude: 46.6103,
      longitude: 13.8558,
    },
    person2: {
      name: 'Tata Umana',
      birthDate: '1982-06-30',
      birthTime: '15:15',
      timezone: 'America/Bogota',
      latitude: 4.711,
      longitude: -74.0721,
    },
    relationshipPreferenceScale: 7,
    relationshipContext: 'Test run: verify V2 prompt layers are active. No name/gematria analysis. Focus on Kabbalah synastry structure.',
    outputLengthContract: {
      targetWordsMin: 700,
      targetWordsMax: 1100,
      hardFloorWords: 600,
      note: 'Smoke test: short output is OK. Prioritize insight density over length.',
    },
    promptLayerDirective: {
      sharedWritingStyleLayerId: 'writing-style-guide-v1',
    },
    chartData: [
      'BIRTH DATA (FOR STRUCTURE ONLY):',
      '- Michael: 1968-08-23 13:45 Europe/Vienna (Villach, Austria)',
      '- Tata Umana: 1982-06-30 15:15 America/Bogota (Bogota, Colombia)',
      '',
      'NOTE:',
      '- This is a smoke test; full computed placements are omitted.',
      '- Do not fall back to name-letter analysis; use Tree of Life structure + synastry dynamics.',
    ].join('\n'),
  } as any;

  const composed = composePromptFromJobStartPayload(payload);
  const userMessage = composed.userMessage || composed.prompt;
  const systemPrompt = composed.systemPrompt || undefined;

  const tag = tsTag();
  const promptPath = path.join(outDir, `smoke_${tag}_kabbalah_synastry.prompt.txt`);
  fs.writeFileSync(promptPath, composed.prompt, 'utf8');
  fs.writeFileSync(path.join(outDir, `smoke_${tag}_kabbalah_synastry.user.txt`), userMessage, 'utf8');
  fs.writeFileSync(path.join(outDir, `smoke_${tag}_kabbalah_synastry.system.txt`), systemPrompt || '', 'utf8');

  const text = await llmPaid.generateStreaming(userMessage, `smoke-kabbalah-${tag}`, {
    maxTokens: 2500,
    temperature: 0.85,
    systemPrompt,
  });

  const textPath = path.join(outDir, `smoke_${tag}_kabbalah_synastry.reading.txt`);
  fs.writeFileSync(textPath, text, 'utf8');

  const pdfResult = await generateReadingPDF({
    type: 'overlay',
    title: `Kabbalah - Michael & Tata Umana`,
    person1: {
      name: payload.person1.name,
      birthDate: payload.person1.birthDate,
      birthTime: payload.person1.birthTime,
      birthPlace: 'Villach, Austria',
      timezone: payload.person1.timezone,
      portraitUrl: path.join(portraitsDir, 'Michael_2.jpg'),
    },
    person2: {
      name: payload.person2.name,
      birthDate: payload.person2.birthDate,
      birthTime: payload.person2.birthTime,
      birthPlace: 'Bogota, Colombia',
      timezone: payload.person2.timezone,
      portraitUrl: path.join(portraitsDir, 'Tata.jpeg'),
    },
    chapters: [
      {
        title: 'Kabbalah Synastry',
        system: 'kabbalah',
        overlayReading: text,
      },
    ],
    generatedAt: new Date(),
  });

  const pdfOutPath = path.join(outDir, `smoke_${tag}_kabbalah_synastry.pdf`);
  fs.copyFileSync(pdfResult.filePath, pdfOutPath);

  console.log('✅ Smoke test artifacts written to:', outDir);
  console.log('-', promptPath);
  console.log('-', textPath);
  console.log('-', pdfOutPath);
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exitCode = 1;
});
