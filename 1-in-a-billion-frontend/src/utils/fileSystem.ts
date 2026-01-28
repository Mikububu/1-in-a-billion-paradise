/**
 * FileSystem Utility
 * 
 * Helper functions to access expo-file-system APIs that may have type issues
 */

import * as FileSystem from 'expo-file-system/legacy';

// Type-safe accessors for FileSystem properties
export const getDocumentDirectory = (): string | null => {
  return (FileSystem as any).documentDirectory || null;
};

export const getCacheDirectory = (): string | null => {
  return (FileSystem as any).cacheDirectory || null;
};

export const EncodingType = {
  Base64: (FileSystem as any).EncodingType?.Base64 || 'base64',
  UTF8: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
};

