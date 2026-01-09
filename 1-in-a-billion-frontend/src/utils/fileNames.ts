/**
 * CENTRALIZED FILENAME GENERATION
 * 
 * All file naming logic lives HERE.
 * Change it once, applies everywhere.
 */

import { FEATURES } from '@/config/features';

/**
 * Clean a string for use in filenames
 * Removes special characters, replaces spaces with underscores
 */
export const cleanForFilename = (str: string): string => {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_')           // Spaces to underscores
    .replace(/_+/g, '_')            // Collapse multiple underscores
    .replace(/^_|_$/g, '');         // Trim leading/trailing underscores
};

/**
 * Generate PDF filename for a reading
 * Format: PersonName_SystemName_v1.0.pdf
 */
export const generatePdfFilename = (
  personName: string,
  systemName: string,
  version?: string
): string => {
  const cleanPerson = cleanForFilename(personName) || 'Reading';
  const cleanSystem = cleanForFilename(systemName) || 'Astrology';
  const ver = version || FEATURES.PDF_VERSION;
  
  return `${cleanPerson}_${cleanSystem}_${ver}.pdf`;
};

/**
 * Generate PDF filename for Core Identities (3-reading bundle)
 * Format: PersonName_Core_Identities_YYYY-MM-DD.pdf
 */
export const generateCoreIdentitiesPdfFilename = (personName: string): string => {
  const cleanPerson = cleanForFilename(personName) || 'User';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `${cleanPerson}_Core_Identities_${today}.pdf`;
};

/**
 * Generate audio filename
 * Format: PersonName_SystemName_audio.mp3
 */
export const generateAudioFilename = (
  personName: string,
  systemName: string
): string => {
  const cleanPerson = cleanForFilename(personName) || 'Reading';
  const cleanSystem = cleanForFilename(systemName) || 'Astrology';
  
  return `${cleanPerson}_${cleanSystem}_audio.mp3`;
};

/**
 * Generate synastry PDF filename
 * Format: Person1_Person2_Synastry_v1.0.pdf
 */
export const generateSynastryPdfFilename = (
  person1Name: string,
  person2Name: string,
  version?: string
): string => {
  const cleanPerson1 = cleanForFilename(person1Name) || 'Person1';
  const cleanPerson2 = cleanForFilename(person2Name) || 'Person2';
  const ver = version || FEATURES.PDF_VERSION;
  
  return `${cleanPerson1}_${cleanPerson2}_Synastry_${ver}.pdf`;
};

/**
 * Generate song filename
 * Format: PersonName_SystemName_song.mp3
 */
export const generateSongFilename = (
  personName: string,
  systemName: string
): string => {
  const cleanPerson = cleanForFilename(personName) || 'Reading';
  const cleanSystem = cleanForFilename(systemName) || 'Astrology';
  
  return `${cleanPerson}_${cleanSystem}_song.mp3`;
};

/**
 * Generate synastry song filename
 * Format: Person1_Person2_System_song.mp3
 */
export const generateSynastrySongFilename = (
  person1Name: string,
  person2Name: string,
  systemName: string
): string => {
  const cleanPerson1 = cleanForFilename(person1Name) || 'Person1';
  const cleanPerson2 = cleanForFilename(person2Name) || 'Person2';
  const cleanSystem = cleanForFilename(systemName) || 'Astrology';
  
  return `${cleanPerson1}_${cleanPerson2}_${cleanSystem}_song.mp3`;
};



