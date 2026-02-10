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
  // For content generation (text/PDF/audio)
  primaryPerson: PersonData;
  secondaryPerson?: PersonData;
  
  // For filename generation
  filenamePerson1: string;
  filenamePerson2?: string;
  
  // Metadata
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
export class DocTypeResolver {
  private docType: DocType;
  private person1: PersonData;
  private person2?: PersonData;

  constructor(docType: DocType, person1: PersonData, person2?: PersonData) {
    this.docType = docType;
    this.person1 = person1;
    this.person2 = person2;
  }

  /**
   * Get resolved person data for this docType
   */
  resolve(): DocTypeResolution {
    const isPerson2Reading = this.docType === 'person2';
    const isOverlayReading = this.docType === 'overlay' || this.docType === 'verdict';
    const isSinglePersonReading = !isOverlayReading;

    // Primary person (who the content is about)
    const primaryPerson = isPerson2Reading && this.person2 
      ? this.person2 
      : this.person1;

    // Secondary person (only for overlay readings)
    const secondaryPerson = isOverlayReading && this.person2 
      ? this.person2 
      : undefined;

    // Filename logic
    let filenamePerson1: string;
    let filenamePerson2: string | undefined;

    if (isOverlayReading) {
      // Overlay: Both names in filename
      filenamePerson1 = this.person1.name;
      filenamePerson2 = this.person2?.name;
    } else if (isPerson2Reading && this.person2) {
      // Person2 reading: Use person2's name only
      filenamePerson1 = this.person2.name;
      filenamePerson2 = undefined;
    } else {
      // Person1 or individual: Use person1's name only
      filenamePerson1 = this.person1.name;
      filenamePerson2 = undefined;
    }

    return {
      primaryPerson,
      secondaryPerson,
      filenamePerson1,
      filenamePerson2,
      isOverlayReading,
      isPerson2Reading,
      isSinglePersonReading,
    };
  }

  /**
   * Get person data for portrait/image URLs
   */
  resolvePortraits(person1PortraitUrl?: string, person2PortraitUrl?: string) {
    const { isPerson2Reading, isOverlayReading } = this.resolve();

    return {
      primaryPortrait: isPerson2Reading ? person2PortraitUrl : person1PortraitUrl,
      secondaryPortrait: isOverlayReading ? person2PortraitUrl : undefined,
    };
  }
}
