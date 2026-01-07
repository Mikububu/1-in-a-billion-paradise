/**
 * Background Reading Processing
 * 
 * Allows LLM readings to continue processing even when app is backgrounded.
 * Uses AsyncStorage to persist job state and expo-notifications for alerts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readingsApi } from './api';
import { HookReading } from '@/types/forms';
import { ProfileSnapshot } from '@/types/api';

// Lazy load expo modules to prevent crash if not installed
let Notifications: typeof import('expo-notifications') | null = null;
let BackgroundFetch: typeof import('expo-background-fetch') | null = null;
let TaskManager: typeof import('expo-task-manager') | null = null;

try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available');
}

try {
  BackgroundFetch = require('expo-background-fetch');
} catch (e) {
  console.warn('expo-background-fetch not available');
}

try {
  TaskManager = require('expo-task-manager');
} catch (e) {
  console.warn('expo-task-manager not available');
}

const STORAGE_KEY = '@pending_readings';
const RESULTS_KEY = '@completed_readings';
const BACKGROUND_TASK_NAME = 'BACKGROUND_READING_FETCH';

// Types
export type ReadingJob = {
  id: string;
  type: 'sun' | 'moon' | 'rising';
  provider: 'deepseek' | 'claude' | 'gpt';
  profile: ProfileSnapshot;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  result?: HookReading;
  error?: string;
};

// Configure notifications (if available)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Request notification permissions
export const requestNotificationPermissions = async () => {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// Get all pending jobs
export const getPendingJobs = async (): Promise<ReadingJob[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Get completed results
export const getCompletedReadings = async (): Promise<Record<string, HookReading>> => {
  try {
    const data = await AsyncStorage.getItem(RESULTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// Save a completed reading
const saveCompletedReading = async (type: string, reading: HookReading) => {
  try {
    const existing = await getCompletedReadings();
    existing[type] = reading;
    await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save completed reading:', e);
  }
};

// Clear completed readings (after consuming them)
export const clearCompletedReadings = async () => {
  await AsyncStorage.removeItem(RESULTS_KEY);
};

// Save pending jobs
const savePendingJobs = async (jobs: ReadingJob[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
};

// Create a new reading job
export const createReadingJob = async (
  type: 'sun' | 'moon' | 'rising',
  provider: 'deepseek' | 'claude' | 'gpt',
  profile: ProfileSnapshot
): Promise<ReadingJob> => {
  const job: ReadingJob = {
    id: `${type}-${provider}-${Date.now()}`,
    type,
    provider,
    profile,
    status: 'pending',
    createdAt: Date.now(),
  };

  const jobs = await getPendingJobs();
  // Remove any existing job for same type
  const filtered = jobs.filter(j => j.type !== type);
  filtered.push(job);
  await savePendingJobs(filtered);

  return job;
};

// Process a single job
export const processJob = async (job: ReadingJob): Promise<HookReading | null> => {
  try {
    console.log(`🔄 Processing ${job.type} reading with ${job.provider}...`);
    
    // Call the appropriate API based on job type
    const apiMethod = readingsApi[job.type];
    if (!apiMethod) {
      console.error(`Unknown reading type: ${job.type}`);
      return null;
    }
    
    // Build payload from profile (without provider - it's a query param on backend)
    const payload = {
      birthDate: job.profile.birthDate,
      birthTime: job.profile.birthTime,
      timezone: job.profile.timezone,
      latitude: job.profile.latitude,
      longitude: job.profile.longitude,
      relationshipIntensity: job.profile.relationshipIntensity,
      relationshipMode: job.profile.relationshipMode,
      primaryLanguage: job.profile.primaryLanguage,
      secondaryLanguage: job.profile.secondaryLanguage,
      languageImportance: job.profile.languageImportance,
    };
    
    const response = await apiMethod(payload);

    if (response?.reading) {
      // ReadingResponse already contains HookReading type
      const reading: HookReading = {
        type: job.type,
        sign: response.reading.sign || 'Unknown',
        intro: response.reading.intro || '',
        main: response.reading.main || '',
      };
      
      // Save to completed readings
      await saveCompletedReading(job.type, reading);
      
      // Remove from pending
      const jobs = await getPendingJobs();
      const filtered = jobs.filter(j => j.id !== job.id);
      await savePendingJobs(filtered);

      return reading;
    }
    return null;
  } catch (error) {
    console.error(`Failed to process ${job.type}:`, error);
    return null;
  }
};

// Process all pending jobs
export const processAllPendingJobs = async (): Promise<number> => {
  const jobs = await getPendingJobs();
  let completed = 0;

  for (const job of jobs) {
    if (job.status === 'pending') {
      const result = await processJob(job);
      if (result) {
        completed++;
      }
    }
  }

  // Send notification if any completed
  if (completed > 0 && Notifications) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Readings Ready ✨',
        body: `${completed} reading${completed > 1 ? 's' : ''} completed. Tap to view.`,
      },
      trigger: null, // Immediately
    });
  }

  return completed;
};

// Background task definition (if available)
if (TaskManager && BackgroundFetch) {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
    try {
      const completed = await processAllPendingJobs();
      console.log(`Background task completed ${completed} readings`);
      return completed > 0 
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('Background task failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

// Register background task
export const registerBackgroundTask = async () => {
  if (!BackgroundFetch) {
    console.warn('BackgroundFetch not available');
    return;
  }
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 15, // 15 seconds minimum (iOS will throttle this)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('✅ Background task registered');
  } catch (error) {
    console.error('Failed to register background task:', error);
  }
};

// Unregister background task
export const unregisterBackgroundTask = async () => {
  if (!BackgroundFetch) return;
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
  } catch (error) {
    console.error('Failed to unregister background task:', error);
  }
};

// Check if background task is registered
export const isBackgroundTaskRegistered = async (): Promise<boolean> => {
  if (!TaskManager) return false;
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
};

// Start processing readings in foreground + register for background
export const startReadingSession = async (
  types: Array<'sun' | 'moon' | 'rising'>,
  provider: 'deepseek' | 'claude' | 'gpt',
  profile: ProfileSnapshot
) => {
  // Create jobs for all types
  for (const type of types) {
    await createReadingJob(type, provider, profile);
  }

  // Register background task
  await registerBackgroundTask();

  // Start processing immediately
  await processAllPendingJobs();
};

// Check for any completed readings when app resumes
export const checkForCompletedReadings = async (): Promise<Record<string, HookReading>> => {
  // First process any remaining pending jobs
  await processAllPendingJobs();
  
  // Then return completed readings
  return getCompletedReadings();
};


