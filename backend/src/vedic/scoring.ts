import { KootaScoreBreakdown, Nakshatra, PersonChart, VedicPerson } from './types';
import {
    getBhakootScore,
    getGanaScore,
    getGrahaMaitriScore,
    getNadiScore,
    getTaraScore,
    getVarnaScore,
    getVashyaScore,
    getYoniScore,
    isNakshatra,
} from './tables';

export type ScorablePerson = Pick<VedicPerson, 'moon_sign' | 'moon_nakshatra'> & Partial<PersonChart>;

function asNakshatra(value: string): Nakshatra | null {
    if (!isNakshatra(value)) {
        return null;
    }

    return value;
}

export function scoreVarna(a: ScorablePerson, b: ScorablePerson): number {
    return getVarnaScore(a.moon_sign || '', b.moon_sign || '');
}

export function scoreVashya(a: ScorablePerson, b: ScorablePerson): number {
    return getVashyaScore(a.moon_sign || '', b.moon_sign || '');
}

export function scoreTara(a: ScorablePerson, b: ScorablePerson): number {
    const nakA = asNakshatra(a.moon_nakshatra);
    const nakB = asNakshatra(b.moon_nakshatra);

    if (!nakA || !nakB) {
        return 0;
    }

    return getTaraScore(nakA, nakB);
}

export function scoreYoni(a: ScorablePerson, b: ScorablePerson): number {
    const nakA = asNakshatra(a.moon_nakshatra);
    const nakB = asNakshatra(b.moon_nakshatra);

    if (!nakA || !nakB) {
        return 2;
    }

    return getYoniScore(nakA, nakB);
}

export function scoreGrahaMaitri(a: ScorablePerson, b: ScorablePerson): number {
    return getGrahaMaitriScore(a.moon_sign || '', b.moon_sign || '');
}

export function scoreGana(a: ScorablePerson, b: ScorablePerson): number {
    const nakA = asNakshatra(a.moon_nakshatra);
    const nakB = asNakshatra(b.moon_nakshatra);

    if (!nakA || !nakB) {
        return 0;
    }

    return getGanaScore(nakA, nakB);
}

export function scoreBhakoot(a: ScorablePerson, b: ScorablePerson): number {
    return getBhakootScore(a.moon_sign || '', b.moon_sign || '');
}

export function scoreNadi(a: ScorablePerson, b: ScorablePerson): number {
    const nakA = asNakshatra(a.moon_nakshatra);
    const nakB = asNakshatra(b.moon_nakshatra);

    if (!nakA || !nakB) {
        return 8;
    }

    return getNadiScore(nakA, nakB);
}

export function scorePair(a: ScorablePerson, b: ScorablePerson): KootaScoreBreakdown {
    const varna = scoreVarna(a, b);
    const vashya = scoreVashya(a, b);
    const tara = scoreTara(a, b);
    const yoni = scoreYoni(a, b);
    const graha_maitri = scoreGrahaMaitri(a, b);
    const gana = scoreGana(a, b);
    const bhakoot = scoreBhakoot(a, b);
    const nadi = scoreNadi(a, b);

    const total = varna + vashya + tara + yoni + graha_maitri + gana + bhakoot + nadi;

    return {
        varna,
        vashya,
        tara,
        yoni,
        graha_maitri,
        gana,
        bhakoot,
        nadi,
        total,
    };
}
