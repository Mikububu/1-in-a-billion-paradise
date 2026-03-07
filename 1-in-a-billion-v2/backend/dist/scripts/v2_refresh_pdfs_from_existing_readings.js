"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const aiPortraitService_1 = require("../services/aiPortraitService");
const coupleImageService_1 = require("../services/coupleImageService");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
dotenv_1.default.config({ path: node_path_1.default.resolve(__dirname, '../../.env') });
function env(name, fallback) {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : fallback;
}
function readImageAsBase64(filePath) {
    return node_fs_1.default.readFileSync(filePath).toString('base64');
}
function addCacheBuster(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${Date.now()}`;
}
function extractCoverQuote(reading) {
    const raw = String(reading || '')
        .replace(/\b(?:individual|overlay|verdict)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
        .trim();
    if (!raw)
        return '';
    const cleanedLines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line))
        .map((line) => line.replace(/^(?:[---]{2,}\s*)?[IVXLC]+\.\s*/i, '').trim())
        .filter((line) => !/^(?:[---]{2,}\s*)?[IVXLC]+\.\s+/i.test(line))
        .filter((line) => !/^[A-Z0-9][A-Z0-9\s,'".:;!?&\-]{14,}$/.test(line))
        .filter((line) => !/^CHART SIGNATURE\s*:/i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const cleaned = cleanedLines || raw.replace(/\s+/g, ' ').trim();
    const m = cleaned.match(/^(.{30,240}?[.!?])(?:\s|$)/);
    if (m?.[1])
        return m[1].trim();
    return cleaned.slice(0, 200).trim();
}
function inferSystem(base) {
    if (base.includes('western-astrology'))
        return 'western';
    if (base.includes('vedic-astrology-jyotish'))
        return 'vedic';
    if (base.includes('human-design'))
        return 'human_design';
    if (base.includes('gene-keys'))
        return 'gene_keys';
    if (base.includes('kabbalah'))
        return 'kabbalah';
    return 'verdict';
}
function displayName(system) {
    if (system === 'western')
        return 'Western Astrology';
    if (system === 'vedic')
        return 'Vedic Astrology';
    if (system === 'human_design')
        return 'Human Design';
    if (system === 'gene_keys')
        return 'Gene Keys';
    if (system === 'kabbalah')
        return 'Kabbalah';
    return 'Final Verdict';
}
async function main() {
    const mediaDir = env('MEDIA_DIR', '/Users/michaelperinwogenburg/Desktop/1-in-a-billion-media/michael_victoria_20260226_180929');
    const portraitsDir = env('PORTRAITS_DIR', '/Users/michaelperinwogenburg/Desktop/Portraits to upload/Michael and Vic');
    const person1Image = env('PERSON1_PORTRAIT_FILE', 'Michael.jpg');
    const person2Image = env('PERSON2_PORTRAIT_FILE', 'Victoria.jpeg');
    const person1 = {
        name: env('PERSON1_NAME', 'Michael'),
        birthDate: env('PERSON1_BIRTH_DATE', '1968-08-23'),
        birthTime: env('PERSON1_BIRTH_TIME', '13:45'),
        birthPlace: env('PERSON1_BIRTH_PLACE', 'Villach, Austria'),
        timezone: env('PERSON1_TIMEZONE', 'Europe/Vienna'),
    };
    const person2 = {
        name: env('PERSON2_NAME', 'Victoria'),
        birthDate: env('PERSON2_BIRTH_DATE', '1982-06-30'),
        birthTime: env('PERSON2_BIRTH_TIME', '15:15'),
        birthPlace: env('PERSON2_BIRTH_PLACE', 'Bogota, Colombia'),
        timezone: env('PERSON2_TIMEZONE', 'America/Bogota'),
    };
    const userId = env('USER_ID', 'f23f2057-5a74-4fc7-ab39-2a1f17729c2c');
    const person1IdBase = env('PERSON1_ID', `self-${userId}`);
    const person2IdBase = env('PERSON2_ID', 'partner-victoria');
    const person1Path = node_path_1.default.join(portraitsDir, person1Image);
    const person2Path = node_path_1.default.join(portraitsDir, person2Image);
    if (!node_fs_1.default.existsSync(person1Path))
        throw new Error(`Missing person1 image: ${person1Path}`);
    if (!node_fs_1.default.existsSync(person2Path))
        throw new Error(`Missing person2 image: ${person2Path}`);
    console.log(`🖼️ Regenerating per-PDF fresh portraits from: ${portraitsDir}`);
    const textFiles = node_fs_1.default
        .readdirSync(mediaDir)
        .filter((f) => f.endsWith('.reading.txt'))
        .sort();
    if (textFiles.length === 0) {
        throw new Error(`No .reading.txt files found in ${mediaDir}`);
    }
    const updated = [];
    for (const txt of textFiles) {
        const base = txt.replace(/\.reading\.txt$/i, '');
        const runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const readingPath = node_path_1.default.join(mediaDir, txt);
        const pdfPath = node_path_1.default.join(mediaDir, `${base}.pdf`);
        const reading = node_fs_1.default.readFileSync(readingPath, 'utf8');
        const system = inferSystem(base);
        const coverQuote = extractCoverQuote(reading);
        let pdf;
        let person1PortraitUrl;
        let person2PortraitUrl;
        let couplePortraitUrl;
        const regenPortrait = async (sourcePath, personId) => {
            const result = await (0, aiPortraitService_1.generateAIPortrait)(readImageAsBase64(sourcePath), userId, personId);
            const baseStorageUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images';
            const fallbackOriginalUrl = `${baseStorageUrl}/${userId}/${personId}/original.jpg`;
            return result.success && result.imageUrl
                ? addCacheBuster(result.imageUrl)
                : addCacheBuster(fallbackOriginalUrl);
        };
        if (base.startsWith('individual_michael_')) {
            const person1Id = `${person1IdBase}-${runToken}`;
            person1PortraitUrl = await regenPortrait(person1Path, person1Id);
            pdf = await (0, pdfGenerator_1.generateReadingPDF)({
                type: 'single',
                title: `${displayName(system)} Reading about ${person1.name}`,
                coverQuote,
                person1: {
                    ...person1,
                    portraitUrl: person1PortraitUrl,
                },
                chapters: [
                    {
                        title: `${displayName(system)} - ${person1.name}`,
                        system,
                        person1Reading: reading,
                    },
                ],
                generatedAt: new Date(),
            });
        }
        else if (base.startsWith('individual_victoria_')) {
            const person2Id = `${person2IdBase}-${runToken}`;
            person2PortraitUrl = await regenPortrait(person2Path, person2Id);
            pdf = await (0, pdfGenerator_1.generateReadingPDF)({
                type: 'single',
                title: `${displayName(system)} Reading about ${person2.name}`,
                coverQuote,
                person1: {
                    ...person2,
                    portraitUrl: person2PortraitUrl,
                },
                chapters: [
                    {
                        title: `${displayName(system)} - ${person2.name}`,
                        system,
                        person1Reading: reading,
                    },
                ],
                generatedAt: new Date(),
            });
        }
        else if (base.startsWith('overlay_michael_victoria_')) {
            const person1Id = `${person1IdBase}-${runToken}-p1`;
            const person2Id = `${person2IdBase}-${runToken}-p2`;
            person1PortraitUrl = await regenPortrait(person1Path, person1Id);
            person2PortraitUrl = await regenPortrait(person2Path, person2Id);
            const coupleImageResult = await (0, coupleImageService_1.composeCoupleImage)(userId, person1Id, person2Id, person1PortraitUrl, person2PortraitUrl);
            couplePortraitUrl =
                coupleImageResult.success && coupleImageResult.coupleImageUrl
                    ? addCacheBuster(coupleImageResult.coupleImageUrl)
                    : undefined;
            pdf = await (0, pdfGenerator_1.generateReadingPDF)({
                type: 'overlay',
                title: `${displayName(system)} Reading about ${person1.name} & ${person2.name}`,
                coverQuote,
                person1: {
                    ...person1,
                    portraitUrl: person1PortraitUrl,
                },
                person2: {
                    ...person2,
                    portraitUrl: person2PortraitUrl,
                },
                coupleImageUrl: couplePortraitUrl,
                chapters: [
                    {
                        title: `${displayName(system)} - ${person1.name} & ${person2.name}`,
                        system,
                        overlayReading: reading,
                    },
                ],
                generatedAt: new Date(),
            });
        }
        else if (base.startsWith('verdict_michael_victoria_')) {
            const person1Id = `${person1IdBase}-${runToken}-p1`;
            const person2Id = `${person2IdBase}-${runToken}-p2`;
            person1PortraitUrl = await regenPortrait(person1Path, person1Id);
            person2PortraitUrl = await regenPortrait(person2Path, person2Id);
            const coupleImageResult = await (0, coupleImageService_1.composeCoupleImage)(userId, person1Id, person2Id, person1PortraitUrl, person2PortraitUrl);
            couplePortraitUrl =
                coupleImageResult.success && coupleImageResult.coupleImageUrl
                    ? addCacheBuster(coupleImageResult.coupleImageUrl)
                    : undefined;
            pdf = await (0, pdfGenerator_1.generateReadingPDF)({
                type: 'overlay',
                title: `Final Verdict about ${person1.name} & ${person2.name}`,
                coverQuote,
                person1: {
                    ...person1,
                    portraitUrl: person1PortraitUrl,
                },
                person2: {
                    ...person2,
                    portraitUrl: person2PortraitUrl,
                },
                coupleImageUrl: couplePortraitUrl,
                chapters: [
                    {
                        title: 'Final Verdict',
                        system: 'verdict',
                        verdict: reading,
                    },
                ],
                generatedAt: new Date(),
            });
        }
        else {
            console.log(`⏭️ Skipping unrecognized file pattern: ${txt}`);
            continue;
        }
        node_fs_1.default.copyFileSync(pdf.filePath, pdfPath);
        updated.push(pdfPath);
        console.log(`✅ Updated PDF: ${pdfPath}`);
    }
    console.log(`\n✅ Refreshed ${updated.length} PDFs in ${mediaDir}`);
}
main().catch((err) => {
    console.error('❌ Failed to refresh PDFs:', err?.message || String(err));
    process.exitCode = 1;
});
//# sourceMappingURL=v2_refresh_pdfs_from_existing_readings.js.map