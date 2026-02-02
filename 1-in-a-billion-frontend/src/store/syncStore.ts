/**
 * SYNC STATUS STORE
 * 
 * Tracks the synchronization status between local data and Supabase cloud.
 * Used to show users whether their data is backed up or needs syncing.
 * 
 * STATES:
 * - 'idle': No sync needed or user not signed in
 * - 'syncing': Currently syncing to cloud
 * - 'synced': All data successfully synced
 * - 'pending': Data changed locally, waiting to sync
 * - 'error': Sync failed, will retry
 * - 'offline': No network connection
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error' | 'offline';

export interface SyncState {
  // Current sync status
  status: SyncStatus;
  
  // Last successful sync timestamp
  lastSyncedAt: number | null;
  
  // Last sync attempt timestamp (even if failed)
  lastAttemptAt: number | null;
  
  // Error message if status is 'error'
  errorMessage: string | null;
  
  // Number of consecutive failures (for exponential backoff)
  failureCount: number;
  
  // Whether we're currently online
  isOnline: boolean;
  
  // Pending sync items (for offline queue)
  pendingItems: {
    type: 'people' | 'audios';
    timestamp: number;
  }[];
  
  // Actions
  setStatus: (status: SyncStatus) => void;
  setSyncing: () => void;
  setSynced: () => void;
  setError: (message: string) => void;
  setPending: () => void;
  setOffline: () => void;
  setOnline: () => void;
  addPendingItem: (type: 'people' | 'audios') => void;
  clearPendingItems: () => void;
  resetFailureCount: () => void;
  incrementFailureCount: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      lastSyncedAt: null,
      lastAttemptAt: null,
      errorMessage: null,
      failureCount: 0,
      isOnline: true,
      pendingItems: [],
      
      setStatus: (status) => set({ status }),
      
      setSyncing: () => set({ 
        status: 'syncing',
        lastAttemptAt: Date.now(),
      }),
      
      setSynced: () => set({ 
        status: 'synced',
        lastSyncedAt: Date.now(),
        errorMessage: null,
        failureCount: 0,
        pendingItems: [],
      }),
      
      setError: (message) => set((state) => ({ 
        status: 'error',
        errorMessage: message,
        failureCount: state.failureCount + 1,
      })),
      
      setPending: () => set({ 
        status: 'pending',
      }),
      
      setOffline: () => set({ 
        status: 'offline',
        isOnline: false,
      }),
      
      setOnline: () => set((state) => ({ 
        isOnline: true,
        // If we were offline and have pending items, set to pending
        status: state.pendingItems.length > 0 ? 'pending' : state.status === 'offline' ? 'idle' : state.status,
      })),
      
      addPendingItem: (type) => set((state) => ({
        pendingItems: [
          ...state.pendingItems.filter(p => p.type !== type), // Remove duplicate type
          { type, timestamp: Date.now() }
        ],
        status: state.isOnline ? 'pending' : 'offline',
      })),
      
      clearPendingItems: () => set({ pendingItems: [] }),
      
      resetFailureCount: () => set({ failureCount: 0 }),
      
      incrementFailureCount: () => set((state) => ({ 
        failureCount: state.failureCount + 1 
      })),
    }),
    {
      name: 'sync-status-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSyncedAt: state.lastSyncedAt,
        pendingItems: state.pendingItems,
        failureCount: state.failureCount,
      }),
    }
  )
);

// Helper to get human-readable sync status
export function getSyncStatusText(status: SyncStatus, lastSyncedAt: number | null): string {
  switch (status) {
    case 'synced':
      if (lastSyncedAt) {
        const ago = Date.now() - lastSyncedAt;
        if (ago < 60000) return 'Synced just now';
        if (ago < 3600000) return `Synced ${Math.floor(ago / 60000)}m ago`;
        if (ago < 86400000) return `Synced ${Math.floor(ago / 3600000)}h ago`;
        return `Synced ${Math.floor(ago / 86400000)}d ago`;
      }
      return 'Synced';
    case 'syncing':
      return 'Syncing...';
    case 'pending':
      return 'Changes pending';
    case 'error':
      return 'Sync failed - will retry';
    case 'offline':
      return 'Offline - not backed up';
    default:
      return '';
  }
}

// Helper to get sync status color
export function getSyncStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'synced':
      return '#22c55e'; // green
    case 'syncing':
      return '#3b82f6'; // blue
    case 'pending':
      return '#f59e0b'; // amber
    case 'error':
      return '#ef4444'; // red
    case 'offline':
      return '#6b7280'; // gray
    default:
      return '#6b7280'; // gray
  }
}

// Calculate next retry delay with exponential backoff
export function getRetryDelay(failureCount: number): number {
  // Base delay: 5 seconds, max: 5 minutes
  const baseDelay = 5000;
  const maxDelay = 300000;
  const delay = Math.min(baseDelay * Math.pow(2, failureCount), maxDelay);
  // Add some jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

// Check if sync is stale (hasn't synced in 24 hours)
export function isSyncStale(lastSyncedAt: number | null): boolean {
  if (!lastSyncedAt) return false; // Never synced = not stale (might be new user)
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  return Date.now() - lastSyncedAt > STALE_THRESHOLD_MS;
}

// Get warning message for stale sync
export function getSyncWarningMessage(lastSyncedAt: number | null, status: SyncStatus): string | null {
  if (status === 'synced') return null;
  if (status === 'syncing') return null;
  
  if (!lastSyncedAt) {
    if (status === 'error' || status === 'offline') {
      return 'Your data has not been backed up yet. Please check your connection.';
    }
    return null;
  }
  
  const hoursSinceSync = Math.floor((Date.now() - lastSyncedAt) / (1000 * 60 * 60));
  
  if (hoursSinceSync >= 48) {
    return `Your data hasn't been backed up in ${Math.floor(hoursSinceSync / 24)} days. Please check your connection.`;
  }
  
  if (hoursSinceSync >= 24) {
    return "Your data hasn't been backed up in over 24 hours. Please check your connection.";
  }
  
  return null;
}
