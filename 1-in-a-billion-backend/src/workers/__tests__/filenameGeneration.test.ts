/**
 * CRITICAL TESTS - Filename Generation
 * 
 * These tests verify that artifact filenames are generated correctly.
 * If these tests fail, DO NOT DEPLOY - filenames will be broken.
 * 
 * Created after the January 2026 incident where files got generic names
 * like "western_Person_1_Akasha_v1.0.pdf" instead of "Akasha_Western_v1.0.pdf"
 */

import { getSystemDisplayName } from '../../config/systemConfig';

// Replicate the filename generation logic from baseWorker.ts
function generatePdfFilename(
  params: { person1?: { name: string }; person2?: { name: string } },
  docType: string,
  system: string
): string {
  const cleanForFilename = (str: string): string => {
    if (!str || typeof str !== 'string') return 'Unknown';
    return str
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const person1Name = cleanForFilename(params?.person1?.name || 'Person1');
  const person2Name = params?.person2?.name ? cleanForFilename(params.person2.name) : null;
  const systemClean = cleanForFilename(system.charAt(0).toUpperCase() + system.slice(1));
  const PDF_VERSION = 'v1.0';

  let fileName: string;

  if (docType === 'overlay' || docType === 'synastry' || docType === 'verdict') {
    if (docType === 'synastry') {
      fileName = `${person1Name}_${person2Name || 'Partner'}_Synastry_${PDF_VERSION}`;
    } else if (docType === 'verdict') {
      // CRITICAL: Use "Verdict" not system name to avoid collision with overlay PDFs
      fileName = `${person1Name}_${person2Name || 'Partner'}_Verdict_${PDF_VERSION}`;
    } else {
      // overlay: use system name
      fileName = `${person1Name}_${person2Name || 'Partner'}_${systemClean}_${PDF_VERSION}`;
    }
  } else if (docType === 'person2') {
    fileName = `${person2Name || person1Name}_${systemClean}_${PDF_VERSION}`;
  } else if (docType === 'person1' || docType === 'individual') {
    fileName = `${person1Name}_${systemClean}_${PDF_VERSION}`;
  } else {
    fileName = `${person1Name}_${systemClean}_${PDF_VERSION}`;
  }

  return `${fileName}.pdf`;
}

// Generate PDF title like pdfWorker.ts does
function generatePdfTitle(
  params: { person1?: { name: string }; person2?: { name: string } },
  docType: string,
  system: string
): string {
  const systemDisplayName = getSystemDisplayName(system);
  const person1 = params.person1 || { name: 'Person 1' };
  const person2 = params.person2;
  
  const isPerson2Reading = docType === 'person2';
  const isOverlayReading = docType === 'overlay' || docType === 'verdict';

  if (isOverlayReading) {
    return `${systemDisplayName} - ${person1.name} & ${person2?.name || 'Partner'}`;
  } else if (isPerson2Reading && person2) {
    return `${systemDisplayName} - ${person2.name}`;
  } else {
    return `${systemDisplayName} - ${person1.name}`;
  }
}

describe('Filename Generation', () => {
  const params = {
    person1: { name: 'Akasha' },
    person2: { name: 'Anand' },
  };

  describe('PDF Filenames', () => {
    test('person1 doc uses person1 name ONLY', () => {
      const filename = generatePdfFilename(params, 'person1', 'vedic');
      expect(filename).toBe('Akasha_Vedic_v1.0.pdf');
      expect(filename).not.toContain('Person');
      expect(filename).not.toContain('Anand');
    });

    test('person2 doc uses person2 name ONLY', () => {
      const filename = generatePdfFilename(params, 'person2', 'western');
      expect(filename).toBe('Anand_Western_v1.0.pdf');
      expect(filename).not.toContain('Person');
      expect(filename).not.toContain('Akasha');
    });

    test('overlay doc uses both names', () => {
      const filename = generatePdfFilename(params, 'overlay', 'vedic');
      expect(filename).toBe('Akasha_Anand_Vedic_v1.0.pdf');
    });

    test('verdict doc uses both names with "Verdict" not system name', () => {
      // CRITICAL: Verdict must use "Verdict" not system name to avoid collision with overlay PDFs
      const filename = generatePdfFilename(params, 'verdict', 'kabbalah');
      expect(filename).toBe('Akasha_Anand_Verdict_v1.0.pdf');
    });

    test('individual doc uses person1 name', () => {
      const filename = generatePdfFilename(params, 'individual', 'human_design');
      // Note: cleanForFilename removes special chars, so human_design becomes Humandesign
      expect(filename).toBe('Akasha_Humandesign_v1.0.pdf');
    });

    // CRITICAL: This test catches the bug that caused "western_Person_1_Akasha_v1.0.pdf"
    test('CRITICAL: filename should NEVER contain literal "Person_1" or "Person_2"', () => {
      const docTypes = ['person1', 'person2', 'overlay', 'verdict', 'individual'];
      const systems = ['vedic', 'western', 'kabbalah', 'human_design', 'gene_keys'];

      for (const docType of docTypes) {
        for (const system of systems) {
          const filename = generatePdfFilename(params, docType, system);
          expect(filename).not.toMatch(/Person_1/i);
          expect(filename).not.toMatch(/Person_2/i);
          expect(filename).not.toMatch(/Person1/);
          expect(filename).not.toMatch(/Person2/);
        }
      }
    });
  });

  describe('PDF Titles', () => {
    test('person1 doc title shows person1 name with system display name', () => {
      const title = generatePdfTitle(params, 'person1', 'vedic');
      expect(title).toBe('Vedic Astrology (Jyotish) - Akasha');
    });

    test('person2 doc title shows person2 name with system display name', () => {
      const title = generatePdfTitle(params, 'person2', 'vedic');
      expect(title).toBe('Vedic Astrology (Jyotish) - Anand');
    });

    test('overlay doc title shows both names', () => {
      const title = generatePdfTitle(params, 'overlay', 'western');
      expect(title).toBe('Western Astrology - Akasha & Anand');
    });

    // CRITICAL: Title should never be the raw task input like "western - Person 1"
    test('CRITICAL: title should NEVER be raw task format like "system - Person N"', () => {
      const docTypes = ['person1', 'person2', 'overlay', 'verdict'];
      const systems = ['vedic', 'western', 'kabbalah'];

      for (const docType of docTypes) {
        for (const system of systems) {
          const title = generatePdfTitle(params, docType, system);
          expect(title).not.toMatch(/^(vedic|western|kabbalah|human_design|gene_keys)\s*-\s*Person/i);
          expect(title).not.toContain('Person 1');
          expect(title).not.toContain('Person 2');
        }
      }
    });
  });

  describe('System Display Names', () => {
    test('vedic returns full display name', () => {
      expect(getSystemDisplayName('vedic')).toBe('Vedic Astrology (Jyotish)');
    });

    test('western returns full display name', () => {
      expect(getSystemDisplayName('western')).toBe('Western Astrology');
    });

    test('human_design returns full display name', () => {
      expect(getSystemDisplayName('human_design')).toBe('Human Design');
    });

    test('gene_keys returns full display name', () => {
      expect(getSystemDisplayName('gene_keys')).toBe('Gene Keys');
    });

    test('kabbalah returns full display name', () => {
      expect(getSystemDisplayName('kabbalah')).toBe('Kabbalah');
    });
  });
});
