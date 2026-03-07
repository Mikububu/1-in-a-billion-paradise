/**
 * SINGLE SOURCE OF TRUTH for DocType Logic
 *
 * All workers MUST use this resolver instead of writing their own checks.
 * Changes here automatically apply to textWorker, pdfWorker, audioWorker, songWorker.
 */
export type DocType = 'person1' | 'person2' | 'overlay' | 'verdict' | 'individual';
export interface PersonData {
    name: string;
    birthDate?: string;
    sunSign?: string;
    moonSign?: string;
    risingSign?: string;
    id?: string;
}
export interface DocTypeResolution {
    primaryPerson: PersonData;
    secondaryPerson?: PersonData;
    filenamePerson1: string;
    filenamePerson2?: string;
    isOverlayReading: boolean;
    isPerson2Reading: boolean;
    isSinglePersonReading: boolean;
}
/**
 * Resolves person data based on docType
 *
 * RULE:
 * - person1 docs → ONLY person1 data
 * - person2 docs → ONLY person2 data (but show person2's info as "primary")
 * - overlay/verdict docs → BOTH people
 *
 * @see docs/TEXT_READING_SPEC.md § 3.3
 * @see docs/CRITICAL_RULES_CHECKLIST.md Rule 1
 */
export declare class DocTypeResolver {
    private docType;
    private person1;
    private person2?;
    constructor(docType: DocType, person1: PersonData, person2?: PersonData);
    /**
     * Get resolved person data for this docType
     */
    resolve(): DocTypeResolution;
    /**
     * Get person data for portrait/image URLs
     */
    resolvePortraits(person1PortraitUrl?: string, person2PortraitUrl?: string): {
        primaryPortrait: string | undefined;
        secondaryPortrait: string | undefined;
    };
}
//# sourceMappingURL=docTypeResolver.d.ts.map