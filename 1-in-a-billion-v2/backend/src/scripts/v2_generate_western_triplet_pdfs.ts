import fs from 'node:fs';
import path from 'node:path';

import { ephemerisIsolation } from '../services/ephemerisIsolation';
import { buildChartDataForSystem } from '../services/chartDataBuilder';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';
import { getSystemDisplayName } from '../config/systemConfig';
import { WORD_COUNT_LIMITS } from '../prompts/config/wordCounts';
import { generateAIPortrait } from '../services/aiPortraitService';
import { composeCoupleImage } from '../services/coupleImageService';
import { buildChartReferencePage } from '../services/chartReferencePage';
import { generateSingleReading, safeFileToken } from './shared/generateReading';
import { generateCompatibilityScores } from './shared/compatibilityScoring';
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
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}

function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

function extractCoverQuote(reading: string): string {
  const raw = String(reading || '')
    .replace(/\b(?:individual|overlay)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
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

function logRunConfig(params: {
  outDir: string;
  portraitsDir: string;
  styleLayerId: string;
  requestedSystem: string;
  requestedJobs: string[];
  hardFloorWords: number;
}): void {
  console.log('⚙️  Triplet run config:');
  console.log(`   - system: ${params.requestedSystem}`);
  console.log(`   - jobs: ${params.requestedJobs.join(', ')}`);
  console.log(`   - styleLayer: ${params.styleLayerId || '(default from registry)'}`);
  console.log(`   - hardFloorWords: ${params.hardFloorWords}`);
  console.log(`   - outputDir: ${params.outDir}`);
  console.log(`   - portraitsDir: ${params.portraitsDir}`);
  console.log(`   - CLAUDE_MODEL: ${process.env.CLAUDE_MODEL || '(env default)'}`);
  console.log(`   - CLAUDE_FALLBACK_MODEL: ${process.env.CLAUDE_FALLBACK_MODEL || '(none)'}`);
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
    : WORD_COUNT_LIMITS.min;
  const argSystem = process.argv.find((arg) => arg.startsWith('--system='));
  const requestedSystem = argSystem ? argSystem.replace('--system=', '').trim().toLowerCase() : 'western';
  const allJobIds = ['person1', 'person2', 'overlay'] as const;
  type JobId = typeof allJobIds[number];
  const argJobs = process.argv.find((arg) => arg.startsWith('--jobs='));
  const requestedJobs = argJobs
    ? argJobs
      .replace('--jobs=', '')
      .split(',')
      .map((j) => j.trim().toLowerCase())
      .filter(Boolean)
    : [...allJobIds];
  const invalidJobs = requestedJobs.filter((j) => !allJobIds.includes(j as JobId));
  if (invalidJobs.length > 0) {
    throw new Error(`Unsupported --jobs values: ${invalidJobs.join(', ')}. Supported: ${allJobIds.join(', ')}`);
  }

  logRunConfig({ outDir, portraitsDir, styleLayerId, requestedSystem, requestedJobs, hardFloorWords });

  const supportedSystems: SystemId[] = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
  if (!supportedSystems.includes(requestedSystem as SystemId)) {
    throw new Error(`Unsupported --system value "${requestedSystem}". Supported: ${supportedSystems.join(', ')}`);
  }
  const system = requestedSystem as SystemId;

  const tag = tsTag();
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

  if (!fs.existsSync(person1.portraitPath)) {
    throw new Error(`Missing base portrait for person1: ${person1.portraitPath}`);
  }
  if (!fs.existsSync(person2.portraitPath)) {
    throw new Error(`Missing base portrait for person2: ${person2.portraitPath}`);
  }

  console.log(`🎨 Regenerating fresh AI portraits from ${portraitsDir}...`);
  const [portrait1Result, portrait2Result] = await Promise.all([
    generateAIPortrait(readImageAsBase64(person1.portraitPath), userId, person1Id),
    generateAIPortrait(readImageAsBase64(person2.portraitPath), userId, person2Id),
  ]);

  if (!portrait1Result.success || !portrait1Result.imageUrl) {
    throw new Error(`Failed to generate person1 AI portrait: ${portrait1Result.error || 'unknown error'}`);
  }
  if (!portrait2Result.success || !portrait2Result.imageUrl) {
    throw new Error(`Failed to generate person2 AI portrait: ${portrait2Result.error || 'unknown error'}`);
  }

  const person1PortraitUrl = addCacheBuster(portrait1Result.imageUrl);
  const person2PortraitUrl = addCacheBuster(portrait2Result.imageUrl);

  console.log('👫 Regenerating fresh couple image from the new AI portraits...');
  const coupleImageResult = await composeCoupleImage(userId, person1Id, person2Id, person1PortraitUrl, person2PortraitUrl);
  const couplePortraitUrl = coupleImageResult.success && coupleImageResult.coupleImageUrl
    ? addCacheBuster(coupleImageResult.coupleImageUrl)
    : undefined;
  if (!couplePortraitUrl) {
    console.warn(`⚠️ Couple image generation failed; using person portrait fallback. Error: ${coupleImageResult.error || 'unknown'}`);
  }

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

  const systemDisplay = getSystemDisplayName(system);
  const person1ChartData = buildChartDataForSystem(system, person1.name, p1Placements, null, null, p1BirthData, null);
  const person2ChartData = buildChartDataForSystem(system, person2.name, p2Placements, null, null, p2BirthData, null);

  const jobs: Array<{
    id: 'person1' | 'person2' | 'overlay';
    personName: string;
    chartData: string;
    payloadBase: Record<string, any>;
    pdfType: 'single' | 'overlay';
    pdfTitle: string;
  }> = [
      {
        id: 'person1',
        personName: person1.name,
        chartData: person1ChartData,
        payloadBase: {
          type: 'extended',
          systems: [system],
          person1: {
            name: person1.name,
            birthDate: person1.birthDate,
            birthTime: person1.birthTime,
            timezone: person1.timezone,
            latitude: person1.latitude,
            longitude: person1.longitude,
          },
          relationshipPreferenceScale: 7,
          outputLanguage: 'en',
          outputLengthContract: {
            targetWordsMin: WORD_COUNT_LIMITS.min,
            targetWordsMax: WORD_COUNT_LIMITS.max,
            hardFloorWords,
            note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${WORD_COUNT_LIMITS.min}-${WORD_COUNT_LIMITS.max} words.`,
          },
          ...(styleLayerId
            ? { promptLayerDirective: { sharedWritingStyleLayerId: styleLayerId } }
            : {}),
        },
        pdfType: 'single',
        pdfTitle: `${systemDisplay} - ${person1.name}`,
      },
      {
        id: 'person2',
        personName: person2.name,
        chartData: person2ChartData,
        payloadBase: {
          type: 'extended',
          systems: [system],
          person1: {
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
            targetWordsMin: WORD_COUNT_LIMITS.min,
            targetWordsMax: WORD_COUNT_LIMITS.max,
            hardFloorWords,
            note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${WORD_COUNT_LIMITS.min}-${WORD_COUNT_LIMITS.max} words.`,
          },
          ...(styleLayerId
            ? { promptLayerDirective: { sharedWritingStyleLayerId: styleLayerId } }
            : {}),
        },
        pdfType: 'single',
        pdfTitle: `${systemDisplay} - ${person2.name}`,
      },
      {
        id: 'overlay',
        personName: `${person1.name} & ${person2.name}`,
        chartData: buildChartDataForSystem(system, person1.name, p1Placements, person2.name, p2Placements, p1BirthData, p2BirthData),
        payloadBase: {
          type: 'synastry',
          systems: [system],
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
            targetWordsMin: WORD_COUNT_LIMITS.min,
            targetWordsMax: WORD_COUNT_LIMITS.max,
            hardFloorWords,
            note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${WORD_COUNT_LIMITS.min}-${WORD_COUNT_LIMITS.max} words.`,
          },
          ...(styleLayerId
            ? { promptLayerDirective: { sharedWritingStyleLayerId: styleLayerId } }
            : {}),
        },
        pdfType: 'overlay',
        pdfTitle: `${systemDisplay} - ${person1.name} & ${person2.name}`,
      },
    ];

  const outputs: string[] = [];

  const jobsToRun = jobs.filter((job) => requestedJobs.includes(job.id));
  for (const job of jobsToRun) {
    console.log(`\n📝 Generating ${system} ${job.id} reading...`);

    const fileBase = job.id === 'overlay'
      ? `overlay_${safeFileToken(person1.name)}_${safeFileToken(person2.name)}_${safeFileToken(systemDisplay)}_${styleToken}_${tag}`
      : `individual_${safeFileToken(job.personName)}_${safeFileToken(systemDisplay)}_${styleToken}_${tag}`;
    const generated = await generateSingleReading({
      system,
      personName: job.personName,
      styleLayerId,
      outDir,
      fileBase,
      chartData: job.chartData,
      payloadBase: job.payloadBase,
      hardFloorWords,
      docType: job.id === 'overlay' ? 'overlay' : 'individual',
    });

    console.log(`🧩 style resolved for ${job.id}: ${generated.resolvedStyleLayerId}`);

    const chartReferencePage = buildChartReferencePage({
      chartData: job.id === 'person2' ? person2ChartData : person1ChartData,
      personName: job.id === 'person2' ? person2.name : person1.name,
      birth: {
        birthDate: job.id === 'person2' ? person2.birthDate : person1.birthDate,
        birthTime: job.id === 'person2' ? person2.birthTime : person1.birthTime,
        birthPlace: job.id === 'person2' ? person2.birthPlace : person1.birthPlace,
      },
      generatedAt: new Date(),
      compact: true,
      system,
    });

    const chartReferencePageRight = job.id === 'overlay'
      ? buildChartReferencePage({
        chartData: person2ChartData,
        personName: person2.name,
        birth: {
          birthDate: person2.birthDate,
          birthTime: person2.birthTime,
          birthPlace: person2.birthPlace,
        },
        generatedAt: new Date(),
        compact: true,
        system,
      })
      : undefined;

    // Separate LLM scoring call for overlay compatibility snapshot (PDF-only)
    let compatibilityScores: Awaited<ReturnType<typeof generateCompatibilityScores>> | undefined;
    if (job.id === 'overlay') {
      compatibilityScores = await generateCompatibilityScores({
        person1Name: person1.name,
        person2Name: person2.name,
        readingText: generated.reading,
        chartData: generated.chartDataForPrompt,
        label: fileBase,
        isVerdict: false,
      });
    }

    const coverQuote = extractCoverQuote(generated.reading);

    const pdf = await generateReadingPDF({
      type: job.pdfType,
      title: `${systemDisplay} Reading about ${job.id === 'overlay' ? `${person1.name} & ${person2.name}` : job.personName}`,
      coverQuote,
      person1: {
        name: job.id === 'person2' ? person2.name : person1.name,
        birthDate: job.id === 'person2' ? person2.birthDate : person1.birthDate,
        birthTime: job.id === 'person2' ? person2.birthTime : person1.birthTime,
        birthPlace: job.id === 'person2' ? person2.birthPlace : person1.birthPlace,
        timezone: job.id === 'person2' ? person2.timezone : person1.timezone,
        portraitUrl: job.id === 'person2' ? person2PortraitUrl : person1PortraitUrl,
      },
      ...(job.id === 'overlay'
        ? {
          person2: {
            name: person2.name,
            birthDate: person2.birthDate,
            birthTime: person2.birthTime,
            birthPlace: person2.birthPlace,
            timezone: person2.timezone,
            portraitUrl: person2PortraitUrl,
          },
          coupleImageUrl: couplePortraitUrl,
        }
        : {}),
      chapters: [
        {
          title: job.pdfTitle,
          system,
          ...(job.id === 'overlay'
            ? { overlayReading: generated.reading }
            : { person1Reading: generated.reading }),
        },
      ],
      compatibilityScores,
      chartReferencePage,
      chartReferencePageRight,
      generatedAt: new Date(),
    });

    const pdfOutPath = path.join(outDir, `${fileBase}.pdf`);
    fs.copyFileSync(pdf.filePath, pdfOutPath);
    outputs.push(pdfOutPath);
    console.log(`✅ Wrote PDF: ${pdfOutPath}`);
  }

  console.log(`\n✅ Done. ${system} triplet PDFs written:`);
  outputs.forEach((file) => console.log(`- ${file}`));
}

main().catch((err) => {
  console.error('❌ v2_generate_western_triplet_pdfs failed:', err?.message || String(err));
  process.exitCode = 1;
}).finally(() => {
  ephemerisIsolation.shutdown();
});
