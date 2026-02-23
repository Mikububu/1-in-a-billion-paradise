import fs from 'node:fs';
import path from 'node:path';

import { ephemerisIsolation } from '../services/ephemerisIsolation';
import { buildChartDataForSystem } from '../services/chartDataBuilder';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';
import { WORD_COUNT_LIMITS_VERDICT } from '../prompts/config/wordCounts';
import { generateAIPortrait } from '../services/aiPortraitService';
import { composeCoupleImage } from '../services/coupleImageService';
import { buildChartReferencePage } from '../services/chartReferencePage';
import { generateSingleReading, safeFileToken } from './shared/generateReading';
import type { SystemId } from '../promptEngine/types';

type PersonSeed = {
  name: string;
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
  birthPlace: string;
  portraitPath: string;
};

function tsTag(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readImageAsBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64');
}

function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

function cleanupDebugArtifacts(outDir: string, fileBase: string): void {
  const files = fs.readdirSync(outDir);
  for (const file of files) {
    if (!file.startsWith(fileBase)) continue;
    if (file.endsWith('.pdf')) continue;
    const abs = path.join(outDir, file);
    try {
      fs.unlinkSync(abs);
    } catch {
      // ignore cleanup errors
    }
  }
}

function extractCoverQuote(reading: string): string {
  const raw = String(reading || '')
    .replace(/\b(?:individual|overlay|verdict)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
    .trim();
  if (!raw) return '';

  const cleanedLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line))
    .map((line) => line.replace(/^(?:[-–—]{2,}\s*)?[IVXLC]+\.\s*/i, '').trim())
    .filter((line) => !/^(?:[-–—]{2,}\s*)?[IVXLC]+\.\s+/i.test(line))
    .filter((line) => !/^[A-Z0-9][A-Z0-9\s,'".:;!?&\-]{14,}$/.test(line))
    .filter((line) => !/^CHART SIGNATURE\s*:/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleaned = cleanedLines || raw.replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/^(.{30,240}?[.!?])(?:\s|$)/);
  if (m?.[1]) return m[1].trim();
  return cleaned.slice(0, 200).trim();
}

function resolveDefaultMediaOutDir(projectRoot: string): string {
  if (process.env.MEDIA_OUT_DIR?.trim()) return process.env.MEDIA_OUT_DIR.trim();
  const desktop = process.env.HOME ? path.join(process.env.HOME, 'Desktop') : '';
  if (desktop && fs.existsSync(desktop)) return path.join(desktop, '1-in-a-billion-media');
  return path.join(projectRoot, 'runtime', 'media');
}

function resolvePortraitsDir(projectRoot: string): string {
  if (process.env.PORTRAITS_DIR?.trim()) return process.env.PORTRAITS_DIR.trim();
  const desktop = process.env.HOME ? path.join(process.env.HOME, 'Desktop') : '';
  const desktopPortraits = desktop ? path.join(desktop, 'Portraits to upload') : '';
  if (desktopPortraits && fs.existsSync(desktopPortraits)) return desktopPortraits;
  return path.join(projectRoot, 'runtime', 'portraits-to-upload');
}

async function main() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const outDir = resolveDefaultMediaOutDir(projectRoot);
  const portraitsDir = resolvePortraitsDir(projectRoot);
  fs.mkdirSync(outDir, { recursive: true });

  const argStyleLayer = process.argv.find((arg) => arg.startsWith('--styleLayer='));
  const styleLayerId = argStyleLayer
    ? argStyleLayer.replace('--styleLayer=', '').trim()
    : 'writing-style-guide-incarnation-v1';
  const styleToken = safeFileToken(styleLayerId);
  const hardFloorWordsRaw = Number(process.env.HARD_FLOOR_WORDS);
  const hardFloorWords = Number.isFinite(hardFloorWordsRaw) && hardFloorWordsRaw > 0
    ? Math.floor(hardFloorWordsRaw)
    : WORD_COUNT_LIMITS_VERDICT.min;

  const userId = process.env.USER_ID || 'f23f2057-5a74-4fc7-ab39-2a1f17729c2c';
  const person1Id = process.env.PERSON1_ID || `self-${userId}`;
  const person2Id = process.env.PERSON2_ID || 'partner-tata-umana-1982';

  const person1: PersonSeed = {
    name: 'Michael',
    birthDate: '1968-08-23',
    birthTime: '13:45',
    timezone: 'Europe/Vienna',
    latitude: 46.6103,
    longitude: 13.8558,
    birthPlace: 'Villach, Austria',
    portraitPath: path.join(portraitsDir, 'Michael_2.jpg'),
  };

  const person2: PersonSeed = {
    name: 'Tata Umana',
    birthDate: '1982-06-30',
    birthTime: '15:15',
    timezone: 'America/Bogota',
    latitude: 4.711,
    longitude: -74.0721,
    birthPlace: 'Bogota, Colombia',
    portraitPath: path.join(portraitsDir, 'Tata.jpeg'),
  };

  if (!fs.existsSync(person1.portraitPath)) throw new Error(`Missing base portrait for person1: ${person1.portraitPath}`);
  if (!fs.existsSync(person2.portraitPath)) throw new Error(`Missing base portrait for person2: ${person2.portraitPath}`);

  console.log('⚙️  Verdict run config:');
  console.log(`   - styleLayer: ${styleLayerId || '(default from registry)'}`);
  console.log(`   - hardFloorWords: ${hardFloorWords}`);
  console.log(`   - outputDir: ${outDir}`);
  console.log(`   - portraitsDir: ${portraitsDir}`);
  console.log(`   - CLAUDE_MODEL: ${process.env.CLAUDE_MODEL || '(env default)'}`);

  console.log(`🎨 Regenerating fresh AI portraits from ${portraitsDir}...`);
  const [portrait1Result, portrait2Result] = await Promise.all([
    generateAIPortrait(readImageAsBase64(person1.portraitPath), userId, person1Id),
    generateAIPortrait(readImageAsBase64(person2.portraitPath), userId, person2Id),
  ]);
  if (!portrait1Result.success || !portrait1Result.imageUrl) throw new Error(`Failed to generate person1 AI portrait: ${portrait1Result.error || 'unknown error'}`);
  if (!portrait2Result.success || !portrait2Result.imageUrl) throw new Error(`Failed to generate person2 AI portrait: ${portrait2Result.error || 'unknown error'}`);

  const person1PortraitUrl = addCacheBuster(portrait1Result.imageUrl);
  const person2PortraitUrl = addCacheBuster(portrait2Result.imageUrl);

  console.log('👫 Regenerating fresh couple image from the new AI portraits...');
  const coupleImageResult = await composeCoupleImage(userId, person1Id, person2Id, person1PortraitUrl, person2PortraitUrl);
  const couplePortraitUrl = coupleImageResult.success && coupleImageResult.coupleImageUrl
    ? addCacheBuster(coupleImageResult.coupleImageUrl)
    : undefined;

  console.log('🧮 Computing Swiss Ephemeris placements for person1/person2...');
  const [p1Placements, p2Placements] = await Promise.all([
    ephemerisIsolation.computePlacements({
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      timezone: person1.timezone,
      latitude: person1.latitude,
      longitude: person1.longitude,
      relationshipIntensity: 7,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    }),
    ephemerisIsolation.computePlacements({
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      timezone: person2.timezone,
      latitude: person2.latitude,
      longitude: person2.longitude,
      relationshipIntensity: 7,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    }),
  ]);

  const p1BirthData = {
    birthDate: person1.birthDate,
    birthTime: person1.birthTime,
    timezone: person1.timezone,
    birthPlace: person1.birthPlace,
  };
  const p2BirthData = {
    birthDate: person2.birthDate,
    birthTime: person2.birthTime,
    timezone: person2.timezone,
    birthPlace: person2.birthPlace,
  };

  const systems: SystemId[] = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
  const systemData = systems.map((system) => {
    const display = system.replace(/_/g, ' ');
    const p1 = buildChartDataForSystem(system, person1.name, p1Placements, null, null, p1BirthData, null);
    const p2 = buildChartDataForSystem(system, person2.name, p2Placements, null, null, p2BirthData, null);
    const overlay = buildChartDataForSystem(system, person1.name, p1Placements, person2.name, p2Placements, p1BirthData, p2BirthData);
    return { system, display, p1, p2, overlay };
  });

  const verdictChartDataParts = systemData.flatMap(({ display, p1, p2, overlay }) => [
    `=== ${display.toUpperCase()} PERSON 1 ===`,
    p1,
    `=== ${display.toUpperCase()} PERSON 2 ===`,
    p2,
    `=== ${display.toUpperCase()} OVERLAY ===`,
    overlay,
  ]);
  const verdictChartData = verdictChartDataParts.join('\n\n');
  const person1AllSystemsChartData = systemData
    .map(({ display, p1 }) => `=== ${display.toUpperCase()} PERSON 1 ===\n${p1}`)
    .join('\n\n');
  const person2AllSystemsChartData = systemData
    .map(({ display, p2 }) => `=== ${display.toUpperCase()} PERSON 2 ===\n${p2}`)
    .join('\n\n');

  const payloadBase: Record<string, any> = {
    type: 'bundle_verdict',
    systems,
    person1: {
      name: person1.name,
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      timezone: person1.timezone,
      latitude: person1.latitude,
      longitude: person1.longitude,
    },
    person2: {
      name: person2.name,
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      timezone: person2.timezone,
      latitude: person2.latitude,
      longitude: person2.longitude,
    },
    relationshipPreferenceScale: 7,
    outputLanguage: 'en',
    outputLengthContract: {
      targetWordsMin: hardFloorWords,
      targetWordsMax: WORD_COUNT_LIMITS_VERDICT.max,
      hardFloorWords,
      note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${hardFloorWords}-${WORD_COUNT_LIMITS_VERDICT.max} words.`,
    },
    ...(styleLayerId
      ? { promptLayerDirective: { sharedWritingStyleLayerId: styleLayerId } }
      : {}),
  };

  const tag = tsTag();
  const fileBase = `verdict_${safeFileToken(person1.name)}_${safeFileToken(person2.name)}_${styleToken}_${tag}`;

  console.log('📝 Generating final verdict reading...');
  const generated = await generateSingleReading({
    system: 'western',
    personName: `${person1.name} & ${person2.name}`,
    styleLayerId,
    outDir,
    fileBase,
    chartData: verdictChartData,
    payloadBase,
    hardFloorWords,
    docType: 'verdict',
  });

  const chartReferencePage = buildChartReferencePage({
    chartData: buildChartDataForSystem('western', person1.name, p1Placements, null, null, p1BirthData, null),
    personName: person1.name,
    birth: {
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: person1.birthPlace,
    },
    generatedAt: new Date(),
    compact: true,
  });

  const chartReferencePageRight = buildChartReferencePage({
    chartData: buildChartDataForSystem('western', person2.name, p2Placements, null, null, p2BirthData, null),
    personName: person2.name,
    birth: {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: person2.birthPlace,
    },
    generatedAt: new Date(),
    compact: true,
  });

  const pdf = await generateReadingPDF({
    type: 'overlay',
    title: `Final Verdict about ${person1.name} & ${person2.name}`,
    coverQuote: extractCoverQuote(generated.reading),
    person1: {
      name: person1.name,
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: person1.birthPlace,
      timezone: person1.timezone,
      portraitUrl: person1PortraitUrl,
    },
    person2: {
      name: person2.name,
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: person2.birthPlace,
      timezone: person2.timezone,
      portraitUrl: person2PortraitUrl,
    },
    coupleImageUrl: couplePortraitUrl,
    chapters: [
      {
        title: 'Final Verdict',
        system: 'verdict',
        verdict: generated.reading,
      },
    ],
    chartReferencePage,
    chartReferencePageRight,
    generatedAt: new Date(),
  });

  const pdfOutPath = path.join(outDir, `${fileBase}.pdf`);
  fs.copyFileSync(pdf.filePath, pdfOutPath);
  cleanupDebugArtifacts(outDir, fileBase);
  console.log(`✅ Wrote PDF: ${pdfOutPath}`);
  console.log('✅ Verdict generation done.');
}

main().catch((err) => {
  console.error('❌ v2_generate_final_verdict_pdf failed:', err?.message || String(err));
  process.exitCode = 1;
}).finally(() => {
  ephemerisIsolation.shutdown();
});
