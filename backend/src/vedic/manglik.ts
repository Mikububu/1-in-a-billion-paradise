export const MANGLIK_HOUSES = new Set<number>([1, 2, 4, 7, 8, 12]);

export interface ManglikInput {
    marsHouse: number;
    lagnaSign: number;
    moonSign: number;
    venusSign?: number;
}

export interface ManglikMatchResult {
    personAManglik: boolean;
    personBManglik: boolean;
    compatible: boolean;
    cancellationApplied: boolean;
}

export function isManglik(marsHouse: number): boolean {
    return MANGLIK_HOUSES.has(marsHouse);
}

export function manglikFromMoon(marsHouse: number, moonHouse: number): boolean {
    const relative = ((marsHouse - moonHouse + 12) % 12) + 1;
    return MANGLIK_HOUSES.has(relative);
}

export function manglikFromVenus(marsHouse: number, venusHouse: number): boolean {
    const relative = ((marsHouse - venusHouse + 12) % 12) + 1;
    return MANGLIK_HOUSES.has(relative);
}

export function manglikCancellation(marsHouse: number, marsSign: number, lagnaSign: number): boolean {
    if (marsSign === 0 || marsSign === 7) {
        return true;
    }

    if (marsSign === 9) {
        return true;
    }

    if (marsSign === 3) {
        return true;
    }

    if (marsHouse === 1 && lagnaSign === marsSign) {
        return true;
    }

    return false;
}

export function matchManglik(
    personA: ManglikInput,
    personB: ManglikInput,
    personAMarsSign: number,
    personBMarsSign: number,
): ManglikMatchResult {
    const personARaw = isManglik(personA.marsHouse);
    const personBRaw = isManglik(personB.marsHouse);

    const personACancelled = personARaw && manglikCancellation(personA.marsHouse, personAMarsSign, personA.lagnaSign);
    const personBCancelled = personBRaw && manglikCancellation(personB.marsHouse, personBMarsSign, personB.lagnaSign);

    const personAFinal = personARaw && !personACancelled;
    const personBFinal = personBRaw && !personBCancelled;

    return {
        personAManglik: personAFinal,
        personBManglik: personBFinal,
        compatible: (personAFinal && personBFinal) || (!personAFinal && !personBFinal),
        cancellationApplied: personACancelled || personBCancelled,
    };
}
