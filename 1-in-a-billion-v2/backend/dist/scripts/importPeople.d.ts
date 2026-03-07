/**
 * IMPORT PEOPLE SCRIPT
 *
 * Imports a list of people with hardcoded geocoding data.
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
declare const PEOPLE_TO_IMPORT: PersonData[];
/**
 * Convert DD.MM.YYYY to YYYY-MM-DD
 */
declare function formatDate(ddmmyyyy: string): string;
/**
 * Sleep for rate limiting
 */
declare function sleep(ms: number): Promise<void>;
declare function importPeople(): Promise<void>;
//# sourceMappingURL=importPeople.d.ts.map