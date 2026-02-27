import fs from 'node:fs';
import path from 'node:path';

import { ephemerisIsolation } from '../services/ephemerisIsolation';
import { buildChartDataForSystem } from '../services/chartDataBuilder';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';
import { getSystemDisplayName } from '../config/systemConfig';
import { WORD_COUNT_LIMITS } from '../prompts/config/wordCounts';
import { generateAIPortrait } from '../services/aiPortraitService';
import { buildChartReferencePage } from '../services/chartReferencePage';
import { generateSingleReading, safeFileToken } from './shared/generateReading';
import type { SystemId } from '../promptEngine/types';

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

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePortraitPath(portraitsDir: string): string {
  const explicit = (process.env.PERSON1_PORTRAIT_PATH || process.env.PERSON1_PORTRAIT_FILE || '').trim();
  if (!explicit) return path.join(portraitsDir, 'Michael_2.jpg');
  if (path.isAbsolute(explicit)) return explicit;
  return path.join(portraitsDir, explicit);
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
  systemsToRun: string[];
}): void {
  console.log('⚙️  Individual run config:');
  console.log(`   - systems: ${params.systemsToRun.join(', ')}`);
  console.log(`   - styleLayer: ${params.styleLayerId || '(default from registry)'}`);
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

  const argPersonalContext = process.argv.find((arg) => arg.startsWith('--personalContext=') || arg.startsWith('--context='));
  const argPersonalContextFile = process.argv.find((arg) => arg.startsWith('--personalContextFile=') || arg.startsWith('--contextFile='));
  const resolvedContextRaw = argPersonalContext
    ? argPersonalContext.split('=').slice(1).join('=')
    : argPersonalContextFile
      ? fs.readFileSync(argPersonalContextFile.split('=').slice(1).join('='), 'utf8')
      : '';
  const resolvedPersonalContext = resolvedContextRaw.trim().length > 0 ? resolvedContextRaw.trim() : undefined;

  const person1 = {
    name: (process.env.PERSON1_NAME || 'Michael').trim(),
    birthDate: (process.env.PERSON1_BIRTH_DATE || '1968-08-23').trim(),
    birthTime: (process.env.PERSON1_BIRTH_TIME || '13:45').trim(),
    timezone: (process.env.PERSON1_TIMEZONE || 'Europe/Vienna').trim(),
    latitude: envNumber('PERSON1_LATITUDE', 46.6103),
    longitude: envNumber('PERSON1_LONGITUDE', 13.8558),
    birthPlace: (process.env.PERSON1_BIRTH_PLACE || 'Villach, Austria').trim(),
    portraitPath: resolvePortraitPath(portraitsDir),
  };
  const userId = process.env.USER_ID || 'f23f2057-5a74-4fc7-ab39-2a1f17729c2c';
  const person1Id = process.env.PERSON1_ID || `self-${userId}`;

  if (!fs.existsSync(person1.portraitPath)) {
    throw new Error(`Missing base portrait for person1: ${person1.portraitPath}`);
  }

  console.log(`🎨 Regenerating fresh AI portrait from ${portraitsDir}...`);
  const portraitResult = await generateAIPortrait(readImageAsBase64(person1.portraitPath), userId, person1Id);
  if (!portraitResult.success || !portraitResult.imageUrl) {
    throw new Error(`Failed to generate person1 AI portrait: ${portraitResult.error || 'unknown error'}`);
  }
  const person1PortraitUrl = addCacheBuster(portraitResult.imageUrl);

  const relationshipPreferenceScale = 7;
  const systems = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'] as const;
  const argSystems = process.argv.find((arg) => arg.startsWith('--systems='));
  const systemsToRun = argSystems
    ? (argSystems
      .replace('--systems=', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as Array<(typeof systems)[number]>)
    : (systems as unknown as Array<(typeof systems)[number]>);

  logRunConfig({
    outDir,
    portraitsDir,
    styleLayerId,
    systemsToRun: systemsToRun.map((s) => String(s)),
  });

  console.log('🧮 Computing placements (Swiss Ephemeris)...');
  const placements = await ephemerisIsolation.computePlacements({
    birthDate: person1.birthDate,
    birthTime: person1.birthTime,
    timezone: person1.timezone,
    latitude: person1.latitude,
    longitude: person1.longitude,
    relationshipIntensity: relationshipPreferenceScale,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  const p1BirthData = {
    birthDate: person1.birthDate,
    birthTime: person1.birthTime,
    timezone: person1.timezone,
    birthPlace: person1.birthPlace,
  };

  const tag = tsTag();

  for (const system of systemsToRun) {
    const systemId = system as SystemId;
    const display = getSystemDisplayName(systemId);
    console.log(`\n📝 Generating ${display} (individual)...`);

    const chartData = buildChartDataForSystem(systemId, person1.name, placements, null, null, p1BirthData, null);

    const payloadBase: Record<string, any> = {
      type: 'extended',
      systems: [systemId],
      person1: {
        name: person1.name,
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        latitude: person1.latitude,
        longitude: person1.longitude,
      },
      relationshipPreferenceScale,
      ...(resolvedPersonalContext ? { personalContext: resolvedPersonalContext } : {}),
      outputLanguage: 'en',
      outputLengthContract: {
        targetWordsMin: WORD_COUNT_LIMITS.min,
        targetWordsMax: WORD_COUNT_LIMITS.max,
        hardFloorWords: WORD_COUNT_LIMITS.min,
        note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${WORD_COUNT_LIMITS.min}-${WORD_COUNT_LIMITS.max} words.`,
      },
      ...(styleLayerId
        ? {
          promptLayerDirective: {
            sharedWritingStyleLayerId: styleLayerId,
          },
        }
        : {}),
    };

    const fileBase = `individual_${safeFileToken(person1.name)}_${safeFileToken(systemId)}_${styleToken}_${tag}`;
    const generated = await generateSingleReading({
      system: systemId,
      personName: person1.name,
      styleLayerId,
      outDir,
      fileBase,
      chartData,
      payloadBase,
      hardFloorWords: WORD_COUNT_LIMITS.min,
      docType: 'individual',
    });

    console.log(`🧩 style resolved for ${display}: ${generated.resolvedStyleLayerId}`);

    const pdfTitle = `${display} Reading about ${person1.name}`;
    const chartReferencePage = buildChartReferencePage({
      chartData: generated.chartDataForPrompt,
      personName: person1.name,
      birth: {
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        birthPlace: person1.birthPlace,
      },
      generatedAt: new Date(),
      compact: true,
      system: systemId,
    });
    const coverQuote = extractCoverQuote(generated.reading);

    const pdf = await generateReadingPDF({
      type: 'single',
      title: pdfTitle,
      coverQuote,
      allowInferredHeadlines: false,
      person1: {
        name: person1.name,
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        birthPlace: person1.birthPlace,
        timezone: person1.timezone,
        portraitUrl: person1PortraitUrl,
      },
      chapters: [
        {
          title: pdfTitle,
          system: systemId,
          person1Reading: generated.reading,
        },
      ],
      chartReferencePage,
      generatedAt: new Date(),
    });

    const pdfOut = path.join(
      outDir,
      `individual_${safeFileToken(person1.name)}_${safeFileToken(display)}_${styleToken}_${tag}.pdf`
    );
    fs.copyFileSync(pdf.filePath, pdfOut);
    console.log(`✅ Wrote PDF: ${pdfOut}`);

    // Persist reading text for downstream audio generation.
    const textOut = pdfOut.replace(/\.pdf$/i, '.reading.txt');
    fs.writeFileSync(textOut, generated.reading, 'utf8');
    console.log(`✅ Wrote reading text: ${textOut}`);
  }

  console.log('\n✅ Done. Outputs in:', outDir);
}

main().catch((err) => {
  console.error('❌ v2_generate_individual_pdfs failed:', err?.message || String(err));
  process.exitCode = 1;
});
