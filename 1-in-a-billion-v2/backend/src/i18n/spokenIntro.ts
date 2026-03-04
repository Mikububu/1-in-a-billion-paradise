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
    } else if (lang === 'ru') {
        if (lower === 'western') return 'Западная Астрология';
        if (lower === 'vedic') return 'Ведическая Астрология';
        if (lower === 'human_design') return 'Дизайн Человека';
        if (lower === 'gene_keys') return 'Генные Ключи';
        if (lower === 'kabbalah') return 'Каббала';
    } else if (lang === 'pt') {
        if (lower === 'western') return 'Astrologia Ocidental';
        if (lower === 'vedic') return 'Astrologia Védica';
        if (lower === 'human_design') return 'Design Humano';
        if (lower === 'gene_keys') return 'Gene Keys';
        if (lower === 'kabbalah') return 'Cabala';
    } else if (lang === 'it') {
        if (lower === 'western') return 'Astrologia Occidentale';
        if (lower === 'vedic') return 'Astrologia Vedica';
        if (lower === 'human_design') return 'Human Design';
        if (lower === 'gene_keys') return 'Gene Keys';
        if (lower === 'kabbalah') return 'Kabbalah';
    } else if (lang === 'ko') {
        if (lower === 'western') return '서양 점성술';
        if (lower === 'vedic') return '베다 점성술';
        if (lower === 'human_design') return '휴먼 디자인';
        if (lower === 'gene_keys') return '진 키';
        if (lower === 'kabbalah') return '카발라';
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
        },
        ru: {
            verdict: `Это итоговое заключение для ${p1Name} и ${p2Name}, синтезирующее все пять систем.`,
            overlayIntro: `Это анализ совместимости ${systemName} для ${p1Name} и ${p2Name}.`,
            individualIntro: `Это анализ ${systemName} для`
        },
        pt: {
            verdict: `Este é o veredicto final para ${p1Name} e ${p2Name}, sintetizando os cinco sistemas.`,
            overlayIntro: `Esta é uma leitura de compatibilidade de ${systemName} para ${p1Name} e ${p2Name}.`,
            individualIntro: `Esta é uma leitura de ${systemName} para`
        },
        it: {
            verdict: `Questo è il verdetto finale per ${p1Name} e ${p2Name}, che sintetizza tutti e cinque i sistemi.`,
            overlayIntro: `Questa è una lettura di compatibilità ${systemName} per ${p1Name} e ${p2Name}.`,
            individualIntro: `Questa è una lettura ${systemName} per`
        },
        ko: {
            verdict: `이것은 ${p1Name} 및 ${p2Name}에 대한 최종 판결 리딩으로, 5가지 시스템을 모두 종합합니다.`,
            overlayIntro: `이것은 ${p1Name} 및 ${p2Name}에 대한 ${systemName} 호환성 리딩입니다.`,
            individualIntro: `이것은 다음에 대한 ${systemName} 리딩입니다:`
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

    if (lang === 'ko') {
        return `${subjectName} 님을 위한 ${systemName} 리딩입니다.`;
    }

    return `${t.individualIntro} ${subjectName}.`.trim();
}
