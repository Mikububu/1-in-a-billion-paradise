import { OutputLanguage } from '../config/languages';

export type AudioPersonMeta = {
    name?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    timezone?: string;
};

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

    const p1 = options.person1 || {};
    const p2 = options.person2 || {};
    const p1Name = String(p1.name || 'Person 1').trim();
    const p2Name = String(p2.name || 'Person 2').trim();

    // Translations - Super simple, no dates or branding for TTS reliability
    const translations: Record<string, { verdict: string; overlayIntro: string; individualIntro: string }> = {
        en: {
            verdict: `This is the final verdict reading for ${p1Name} and ${p2Name}, synthesizing all five systems.`,
            overlayIntro: `This is a ${systemName} compatibility reading for ${p1Name} and ${p2Name}.`,
            individualIntro: `This is a ${systemName} reading for`
        },
        de: {
            verdict: `Dies ist die abschließende Gesamt-Analyse für ${p1Name} und ${p2Name}, die alle fünf Systeme zusammenfasst.`,
            overlayIntro: `Dies ist eine ${systemName} Kompatibilitätsanalyse für ${p1Name} und ${p2Name}.`,
            individualIntro: `Dies ist eine ${systemName} Analyse für`
        },
        es: {
            verdict: `Esta es la lectura del veredicto final para ${p1Name} y ${p2Name}, sintetizando los cinco sistemas.`,
            overlayIntro: `Esta es una lectura de compatibilidad de ${systemName} para ${p1Name} y ${p2Name}.`,
            individualIntro: `Esta es una lectura de ${systemName} para`
        },
        fr: {
            verdict: `Ceci est la lecture du verdict final pour ${p1Name} et ${p2Name}, synthétisant les cinq systèmes.`,
            overlayIntro: `Ceci est une lecture de compatibilité en ${systemName} pour ${p1Name} et ${p2Name}.`,
            individualIntro: `Ceci est une lecture en ${systemName} pour`
        },
        zh: {
            verdict: `这是 ${p1Name} 和 ${p2Name} 的最终判决解读，综合了所有五个系统。`,
            overlayIntro: `这是 ${p1Name} 和 ${p2Name} 的 ${systemName} 契合度解读。`,
            individualIntro: `这是关于`
        }
    };

    const t = translations[lang] || translations.en;

    if (options.docType === 'verdict') {
        return t.verdict.trim();
    }

    if (options.docType === 'overlay') {
        return t.overlayIntro.trim();
    }

    const subject = options.docType === 'person2' ? p2 : p1;
    const subjectName = String(subject.name || (options.docType === 'person2' ? p2Name : p1Name)).trim();

    if (lang === 'zh') {
        return `${t.individualIntro} ${subjectName} 的 ${systemName} 解读。`;
    }

    return `${t.individualIntro} ${subjectName}.`.trim();
}
