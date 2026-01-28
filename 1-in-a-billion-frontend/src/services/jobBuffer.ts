/**
 * JOB BUFFER SERVICE
 *
 * Keeps at most JOB_BUFFER_MAX (40) deep-reading jobs "in the buffer" on the phone.
 * When a 41st job is added, the oldest is auto-deleted:
 * - Removed from the receipts list
 * - Local media for that job (library-media folders, audio-cache files) is deleted
 *
 * Used by: GeneratingReadingScreen (add receipt), optional enforcement on library load.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { getDocumentDirectory, getCacheDirectory } from '@/utils/fileSystem';

const RECEIPTS_KEY = '@deep_reading_job_receipts';
export const JOB_BUFFER_MAX = 40;

export type JobReceipt = {
  jobId: string;
  productType?: string;
  productName?: string;
  personName?: string;
  partnerName?: string;
  readingType?: string;
  createdAt: string;
};

function sanitize(s: string): string {
  return String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_');
}

/**
 * Delete local media (library-media folders, audio-cache files) for the given job IDs.
 * Folders are named like {ts}_{jobId}_{docNum}; we match *_jobId_*.
 */
async function deleteLocalMediaForJobs(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;

  const baseDoc = getDocumentDirectory();
  const baseCache = getCacheDirectory();
  const mediaBase = baseDoc || baseCache ? `${baseDoc || baseCache}library-media/` : '';
  const audioCacheBase = baseCache ? `${baseCache}audio-cache/` : '';

  const toDelete: string[] = [];

  if (mediaBase) {
    try {
      const info = await FileSystem.getInfoAsync(mediaBase);
      if (info.exists) {
        const persons = await FileSystem.readDirectoryAsync(mediaBase);
        for (const person of persons) {
          const personPath = `${mediaBase}${person}`;
          const personInfo = await FileSystem.getInfoAsync(personPath);
          if (!personInfo.exists || !(personInfo as any).isDirectory) continue;
          const systems = await FileSystem.readDirectoryAsync(personPath);
          for (const sys of systems) {
            const sysPath = `${personPath}/${sys}`;
            const sysInfo = await FileSystem.getInfoAsync(sysPath);
            if (!sysInfo.exists || !(sysInfo as any).isDirectory) continue;
            const leafs = await FileSystem.readDirectoryAsync(sysPath);
            for (const leaf of leafs) {
              const leafPath = `${sysPath}/${leaf}`;
              const leafInfo = await FileSystem.getInfoAsync(leafPath);
              if (!leafInfo.exists || !(leafInfo as any).isDirectory) continue;
              for (const jid of jobIds) {
                const need = `_${sanitize(jid)}_`;
                if (leaf.includes(need)) {
                  toDelete.push(leafPath);
                  break;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[jobBuffer] list library-media:', e);
    }
  }

  if (audioCacheBase) {
    try {
      const info = await FileSystem.getInfoAsync(audioCacheBase);
      if (info.exists) {
        const files = await FileSystem.readDirectoryAsync(audioCacheBase);
        for (const f of files) {
          if (!f.endsWith('.mp3') && !f.endsWith('.m4a')) continue;
          for (const jid of jobIds) {
            const prefix = `${sanitize(jid)}_`;
            if (f.startsWith(prefix)) {
              toDelete.push(`${audioCacheBase}${f}`);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[jobBuffer] list audio-cache:', e);
    }
  }

  for (const p of toDelete) {
    try {
      await FileSystem.deleteAsync(p, { idempotent: true });
    } catch (e) {
      console.warn('[jobBuffer] delete:', p, e);
    }
  }
}

/**
 * Load current receipts from storage.
 */
export async function getJobReceipts(): Promise<JobReceipt[]> {
  try {
    const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r: any) => r?.jobId) : [];
  } catch {
    return [];
  }
}

/**
 * Prune receipts to JOB_BUFFER_MAX, delete local media for removed jobs, persist.
 * Call this when adding a new job or when enforcing cap (e.g. app init).
 */
async function pruneAndPersist(candidate: JobReceipt[]): Promise<JobReceipt[]> {
  const existing = await getJobReceipts();
  const existingIds = new Set(existing.map((r) => r.jobId));
  const next: JobReceipt[] = [];
  const seen = new Set<string>();
  for (const r of candidate) {
    if (!r?.jobId || seen.has(r.jobId)) continue;
    seen.add(r.jobId);
    next.push(r);
  }
  next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pruned = next.slice(0, JOB_BUFFER_MAX);
  const removed = next.slice(JOB_BUFFER_MAX).map((r) => r.jobId);
  if (removed.length > 0) {
    await deleteLocalMediaForJobs(removed);
  }
  await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(pruned));
  return pruned;
}

/**
 * Add a job receipt to the buffer. If we exceed JOB_BUFFER_MAX, oldest are auto-deleted
 * (receipts + local media).
 */
export async function addJobToBuffer(receipt: JobReceipt): Promise<void> {
  const existing = await getJobReceipts();
  const candidate = [receipt, ...existing.filter((r) => r.jobId !== receipt.jobId)];
  await pruneAndPersist(candidate);
}

/**
 * Enforce cap without adding. Use on app init or library load to prune if we
 * previously had a larger cap (e.g. 50) and now use 40.
 */
export async function enforceJobBufferCap(): Promise<void> {
  const existing = await getJobReceipts();
  if (existing.length <= JOB_BUFFER_MAX) return;
  await pruneAndPersist(existing);
}
