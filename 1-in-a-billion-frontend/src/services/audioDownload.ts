/**
 * AUDIO DOWNLOAD SERVICE
 * 
 * Handles downloading and saving audio files to device.
 * Uses expo-file-system (legacy API) and expo-sharing.
 */

import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const getAudioDirectory = () => {
  // Prefer documentDirectory, but fall back to cacheDirectory.
  // In some dev-client/runtime edge cases, documentDirectory can be null/empty (seen in logs).
  const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
  return baseDir ? `${baseDir}readings/` : '';
};

/**
 * Ensure the audio directory exists
 */
export const ensureAudioDirectory = async () => {
  try {
    const audioDir = getAudioDirectory();
    if (!audioDir) {
      console.warn('Audio directory path is empty - documentDirectory not available');
      return;
    }
    const dirInfo = await FileSystem.getInfoAsync(audioDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    }
  } catch (error) {
    console.error('Error ensuring audio directory:', error);
    // Try to create it anyway
    try {
      const audioDir = getAudioDirectory();
      if (audioDir) {
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      }
    } catch (e) {
      console.error('Failed to create audio directory:', e);
    }
  }
};

/**
 * Save base64 audio to file and return local URI
 */
export const saveAudioToFile = async (
  base64Audio: string,
  fileName: string
): Promise<string> => {
  await ensureAudioDirectory();

  const dir = getAudioDirectory();
  if (!dir) throw new Error('No writable directory available (documentDirectory/cacheDirectory missing)');
  const filePath = `${dir}${fileName}.mp3`;

  // Remove data URL prefix if present
  const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, '');

  if (!cleanBase64 || cleanBase64.length < 100) {
    throw new Error('Invalid base64 audio data');
  }

  try {
    await FileSystem.writeAsStringAsync(filePath, cleanBase64, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });
  } catch (writeError: any) {
    console.error('Write error:', writeError);
    throw new Error(`Failed to write audio file: ${writeError.message}`);
  }

  return filePath;
};

/**
 * Download audio from URL and save locally
 */
export const downloadAudioFromUrl = async (
  audioUrl: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  await ensureAudioDirectory();

  const dir = getAudioDirectory();
  if (!dir) throw new Error('No writable directory available (documentDirectory/cacheDirectory missing)');
  const filePath = `${dir}${fileName}.mp3`;

  const downloadResumable = FileSystem.createDownloadResumable(
    audioUrl,
    filePath,
    {},
    (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress?.(progress);
    }
  );

  const result = await downloadResumable.downloadAsync();

  if (!result?.uri) {
    throw new Error('Download failed');
  }

  return result.uri;
};

/**
 * Share/export audio file (allows saving to Files app, etc.)
 */
export const shareAudioFile = async (filePath: string, title?: string): Promise<boolean> => {
  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    Alert.alert('Sharing not available', 'Unable to share files on this device.');
    return false;
  }

  try {
    await Sharing.shareAsync(filePath, {
      mimeType: 'audio/mpeg',
      dialogTitle: title || 'Save your reading',
      UTI: 'public.mp3', // iOS
    });
    return true;
  } catch (error) {
    console.error('Share error:', error);
    return false;
  }
};

/**
 * Get list of saved audio files
 */
export const getSavedAudios = async (): Promise<string[]> => {
  const docDir = (FileSystem as any).documentDirectory;
  if (!docDir) return [];

  await ensureAudioDirectory();

  try {
    const audioDir = getAudioDirectory();
    if (!audioDir) return [];
    const files = await FileSystem.readDirectoryAsync(audioDir);
    return files.filter((f: string) => f.endsWith('.mp3'));
  } catch {
    return [];
  }
};

/**
 * Delete a saved audio file
 */
export const deleteAudio = async (fileName: string): Promise<void> => {
  const docDir = (FileSystem as any).documentDirectory;
  if (!docDir) return;

  const filePath = `${getAudioDirectory()}${fileName}`;

  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('Delete audio error:', error);
  }
};

/**
 * Get file size in MB
 */
export const getAudioFileSize = async (filePath: string): Promise<number> => {
  const docDir = (FileSystem as any).documentDirectory;
  if (!docDir) return 0;

  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists && 'size' in fileInfo) {
      return (fileInfo as any).size / (1024 * 1024); // Convert to MB
    }
  } catch (error) {
    console.error('Get file size error:', error);
  }
  return 0;
};

/**
 * Generate a clean filename from reading metadata
 */
export const generateAudioFileName = (
  userName: string,
  partnerName?: string,
  system?: string,
  type?: 'solo' | 'overlay' | 'complete'
): string => {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];

  if (type === 'complete' && partnerName) {
    return `complete_${sanitize(userName)}_${sanitize(partnerName)}_${date}`;
  }
  if (type === 'overlay' && partnerName) {
    return `overlay_${sanitize(userName)}_${sanitize(partnerName)}_${system || 'western'}_${date}`;
  }
  return `reading_${sanitize(userName)}_${system || 'western'}_${date}`;
};





