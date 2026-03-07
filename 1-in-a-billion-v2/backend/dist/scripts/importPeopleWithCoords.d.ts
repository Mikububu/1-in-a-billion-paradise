/**
 * IMPORT PEOPLE WITH PRE-GEOCODED COORDINATES
 *
 * Uses manually researched coordinates for accuracy
 */
interface PersonData {
    name: string;
    birthDate: string;
    birthTime: string;
    birthCity: string;
    latitude: number;
    longitude: number;
    timezone: string;
}
declare const PEOPLE_WITH_COORDS: PersonData[];
declare function importPeopleWithCoords(): Promise<void>;
//# sourceMappingURL=importPeopleWithCoords.d.ts.map