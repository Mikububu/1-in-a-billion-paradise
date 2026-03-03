import { OutputLanguage } from '../config/languages';

type AudioPersonMeta = {
    name?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    timezone?: string;
};

// Ordinal suffixes for English
function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
}

/**
 * Parses numeric dates (e.g. "1980-03-12") into natural, spoken-word formats
 * optimized specifically for TTS engines to pronounce correctly.
 */
function formatSpokenDate(input: string | undefined, lang: OutputLanguage): string {
    const raw = String(input || '').trim();
    if (!raw) return '';

    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
        // Fallback: If it's already a full string or unparsable, just return it.
        return raw;
    }

    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d));

    switch (lang) {
        case 'en': {
            // "March 12th, 1980"
            const month = dt.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
            return `${month} ${d}${getOrdinalSuffix(d)} ${y}`;
        }
        case 'de': {
            // "12. März 1980" (The dot forces German TTS to pronounce ordinals)
            const month = dt.toLocaleDateString('de-DE', { month: 'long', timeZone: 'UTC' });
            return `${d}. ${month} ${y}`;
        }
        case 'es': {
            // "12 de marzo de 1980"
            const month = dt.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
            return `${d} de ${month} de ${y}`;
        }
        case 'fr': {
            // "1er mars 1980" or "12 mars 1980"
            const month = dt.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
            const dayStr = d === 1 ? '1er' : String(d);
            return `${dayStr} ${month} ${y}`;
        }
        case 'zh': {
            // "1980年3月12日"
            return `${y}年${mo + 1}月${d}日`;
        }
        default: {
            const month = dt.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
            return `${month} ${d}${getOrdinalSuffix(d)}, ${y}`;
        }
    }
}

function getSystemDisplayName(system: string, lang: OutputLanguage): string {
    const lower = system.toLowerCase();

    if (lang === 'de') {
        if (lower === 'western') return 'Westliche Astrologie';
        if (lower === 'vedic') return 'Vedische Astrologie';
        if (lower === 'human_design') return 'Human Design';
        if (lower === 'gene_keys') return 'Gene Keys';
        if (lower === 'kabbalah') return 'Kabbalah';
    } else if (lang === 'es') {
        if (lower === 'western') return 'Astrología Occidental';
        if (lower === 'vedic') return 'Astrología Védica';
        if (lower === 'human_design') return 'Diseño Humano';
        if (lower === 'gene_keys') return 'Claves Genéticas';
        if (lower === 'kabbalah') return 'Cábala';
    } else if (lang === 'fr') {
        if (lower === 'western') return 'Astrologie Occidentale';
        if (lower === 'vedic') return 'Astrologie Védique';
        if (lower === 'human_design') return 'Design Humain';
        if (lower === 'gene_keys') return 'Clés Génétiques';
        if (lower === 'kabbalah') return 'Kabbale';
    } else if (lang === 'zh') {
        if (lower === 'western') return '西方占星术';
        if (lower === 'vedic') return '吠陀占星术';
        if (lower === 'human_design') return '人类图';
        if (lower === 'gene_keys') return '基因天命';
        if (lower === 'kabbalah') return '卡巴拉';
    }

    // Default EN
    if (lower === 'western') return 'Western Astrology';
    if (lower === 'vedic') return 'Vedic Astrology';
    if (lower === 'human_design') return 'Human Design';
    if (lower === 'gene_keys') return 'Gene Keys';
    if (lower === 'kabbalah') return 'Kabbalah';

    return system;
}

export function buildLocalizedSpokenIntro(options: {
    system?: string;
    docType: 'person1' | 'person2' | 'overlay' | 'verdict';
    person1?: AudioPersonMeta;
    person2?: AudioPersonMeta;
    language: OutputLanguage;
}): string {
    const lang = options.language || 'en';
    const systemName = getSystemDisplayName(options.system || 'western', lang);

    const generatedOn = formatSpokenDate(new Date().toISOString().split('T')[0], lang);

    const p1 = options.person1 || {};
    const p2 = options.person2 || {};
    const p1Name = String(p1.name || 'Person 1').trim();
    const p2Name = String(p2.name || 'Person 2').trim();

    const p1Date = formatSpokenDate(p1.birthDate, lang);
    const p2Date = formatSpokenDate(p2.birthDate, lang);

    // Use birthPlace (city name) only.
    const p1Place = String(p1.birthPlace || '').trim();
    const p2Place = String(p2.birthPlace || '').trim();
    const p1Time = String(p1.birthTime || '').trim();
    const p2Time = String(p2.birthTime || '').trim();

    // Translations
    const translations = {
        en: {
            unknownDate: 'an unknown date',
            at: 'at',
            in: 'in',
            verdict: `This is the final verdict reading for ${p1Name} and ${p2Name}, synthesizing all five systems. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`,
            bornOn: 'was born on',
            overlayIntro: `This is a ${systemName} compatibility reading for ${p1Name} and ${p2Name}.`,
            overlayOutro: `Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`,
            individualIntro: `This is a ${systemName} reading for`
        },
        de: {
            unknownDate: 'einem unbekannten Datum',
            at: 'um',
            in: 'in',
            verdict: `Dies ist die abschließende Gesamt-Analyse für ${p1Name} und ${p2Name}, die alle fünf Systeme zusammenfasst. Generiert am ${generatedOn} von der 1 in a billion App, unterstützt von forbidden-yoga dot com.`,
            bornOn: 'wurde geboren am',
            overlayIntro: `Dies ist eine ${systemName} Kompatibilitätsanalyse für ${p1Name} und ${p2Name}.`,
            overlayOutro: `Generiert am ${generatedOn} von der 1 in a billion App, unterstützt von forbidden-yoga dot com.`,
            individualIntro: `Dies ist eine ${systemName} Analyse für`
        },
        es: {
            unknownDate: 'una fecha desconocida',
            at: 'a las',
            in: 'en',
            verdict: `Esta es la lectura del veredicto final para ${p1Name} y ${p2Name}, sintetizando los cinco sistemas. Generado el ${generatedOn} por la aplicación 1 in a billion, impulsado por forbidden-yoga punto com.`,
            bornOn: 'nació el',
            overlayIntro: `Esta es una lectura de compatibilidad de ${systemName} para ${p1Name} y ${p2Name}.`,
            overlayOutro: `Generado el ${generatedOn} por la aplicación 1 in a billion, impulsado por forbidden-yoga punto com.`,
            individualIntro: `Esta es una lectura de ${systemName} para`
        },
        fr: {
            unknownDate: 'une date inconnue',
            at: 'à',
            in: 'à',
            verdict: `Ceci est la lecture du verdict final pour ${p1Name} et ${p2Name}, synthétisant les cinq systèmes. Généré le ${generatedOn} par l'application 1 in a billion, propulsé par forbidden-yoga point com.`,
            bornOn: 'est né le',
            overlayIntro: `Ceci est une lecture de compatibilité en ${systemName} pour ${p1Name} et ${p2Name}.`,
            overlayOutro: `Généré le ${generatedOn} par l'application 1 in a billion, propulsé par forbidden-yoga point com.`,
            individualIntro: `Ceci est une lecture en ${systemName} pour`
        },
        zh: {
            unknownDate: '未知日期',
            at: '时间',
            in: '地点',
            verdict: `这是 ${p1Name} 和 ${p2Name} 的最终判决解读，综合了所有五个系统。由 1 in a billion 应用程序在 ${generatedOn} 生成，由 forbidden-yoga dot com 提供支持。`,
            bornOn: '出生于',
            overlayIntro: `这是 ${p1Name} 和 ${p2Name} 的 ${systemName} 契合度解读。`,
            overlayOutro: `由 1 in a billion 应用程序在 ${generatedOn} 生成，由 forbidden-yoga dot com 提供支持。`,
            individualIntro: `这是关于`
        }
    };

    const t = translations[lang] || translations.en;

    if (options.docType === 'verdict') {
        return t.verdict;
    }

    if (options.docType === 'overlay') {
        let p1Line = '';
        let p2Line = '';

        if (lang === 'zh') {
            p1Line = `${p1Name} ${t.bornOn} ${p1Date || t.unknownDate}${p1Time ? ` ${p1Time}` : ''}${p1Place ? ` ${t.in} ${p1Place}` : ''}。`;
            p2Line = `${p2Name} ${t.bornOn} ${p2Date || t.unknownDate}${p2Time ? ` ${p2Time}` : ''}${p2Place ? ` ${t.in} ${p2Place}` : ''}。`;
        } else {
            p1Line = `${p1Name} ${t.bornOn} ${p1Date || t.unknownDate}${p1Time ? ` ${t.at} ${p1Time}` : ''}${p1Place ? ` ${t.in} ${p1Place}` : ''}.`;
            p2Line = `${p2Name} ${t.bornOn} ${p2Date || t.unknownDate}${p2Time ? ` ${t.at} ${p2Time}` : ''}${p2Place ? ` ${t.in} ${p2Place}` : ''}.`;
        }

        return `${t.overlayIntro} ${p1Line} ${p2Line} ${t.overlayOutro}`;
    }

    const subject = options.docType === 'person2' ? p2 : p1;
    const subjectName = String(subject.name || (options.docType === 'person2' ? p2Name : p1Name)).trim();
    const birthDate = formatSpokenDate(subject.birthDate, lang);
    const birthPlace = String(subject.birthPlace || '').trim();
    const birthTime = String(subject.birthTime || '').trim();

    if (lang === 'zh') {
        return `${t.individualIntro} ${subjectName} 的 ${systemName} 解读，${t.bornOn} ${birthDate || t.unknownDate}${birthTime ? ` ${birthTime}` : ''}${birthPlace ? ` ${t.in} ${birthPlace}` : ''}。${t.overlayOutro}`;
    }

    return `${t.individualIntro} ${subjectName}, ${t.bornOn} ${birthDate || t.unknownDate}${birthTime ? ` ${t.at} ${birthTime}` : ''}${birthPlace ? ` ${t.in} ${birthPlace}` : ''}. ${t.overlayOutro}`;
}
