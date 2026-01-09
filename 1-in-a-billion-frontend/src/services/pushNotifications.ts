/**
 * PUSH NOTIFICATIONS SERVICE
 * 
 * Handles push notification registration, token storage, and job subscriptions.
 * Supports both Expo push notifications and email fallback.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from './supabase';
import { env } from '@/config/env';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushToken = {
  token: string;
  type: 'expo' | 'apns' | 'fcm';
  platform: 'ios' | 'android' | 'web';
};

/**
 * Register for push notifications and get the token
 */
export async function registerForPushNotifications(): Promise<PushToken | null> {
  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Push notification permission denied');
    return null;
  }

  try {
    // Get project ID from Constants (expo-constants)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId 
      || Constants.easConfig?.projectId
      || env.EXPO_PROJECT_ID;

    if (!projectId) {
      console.warn('⚠️ No Expo project ID found, push notifications may not work');
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token: PushToken = {
      token: tokenData.data,
      type: 'expo',
      platform: Platform.OS as 'ios' | 'android',
    };

    console.log('✅ Push token obtained:', token.token.slice(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('❌ Failed to get push token:', error);
    // On simulator or when push fails, return null (email will be fallback)
    return null;
  }
}

/**
 * Store push token in Supabase for a user
 */
export async function storePushToken(userId: string, pushToken: PushToken): Promise<boolean> {
  if (!isSupabaseConfigured || !userId || !pushToken) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: pushToken.token,
        token_type: pushToken.type,
        platform: pushToken.platform,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,push_token',
      });

    if (error) {
      console.error('❌ Failed to store push token:', error.message);
      return false;
    }

    console.log('✅ Push token stored in Supabase');
    return true;
  } catch (err) {
    console.error('❌ Exception storing push token:', err);
    return false;
  }
}

/**
 * Subscribe to notifications for a specific job
 */
export async function subscribeToJobNotifications(
  userId: string, 
  jobId: string, 
  options: { 
    pushEnabled?: boolean; 
    emailEnabled?: boolean;
    email?: string;
  } = {}
): Promise<boolean> {
  if (!isSupabaseConfigured || !userId || !jobId) {
    return false;
  }

  const { pushEnabled = true, emailEnabled = true, email } = options;

  try {
    const { error } = await supabase
      .from('job_notification_subscriptions')
      .upsert({
        user_id: userId,
        job_id: jobId,
        push_enabled: pushEnabled,
        email_enabled: emailEnabled,
        email: email || null,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,job_id',
      });

    if (error) {
      console.error('❌ Failed to subscribe to job notifications:', error.message);
      return false;
    }

    console.log('✅ Subscribed to notifications for job:', jobId.slice(0, 8));
    return true;
  } catch (err) {
    console.error('❌ Exception subscribing to notifications:', err);
    return false;
  }
}

/**
 * Full registration flow: get token, store it, subscribe to job
 */
export async function enableNotificationsForJob(
  userId: string,
  jobId: string,
  email?: string
): Promise<{ success: boolean; pushEnabled: boolean; error?: string }> {
  // Step 1: Register for push notifications
  const pushToken = await registerForPushNotifications();
  const pushEnabled = !!pushToken;

  // Step 2: Store push token if obtained
  if (pushToken) {
    await storePushToken(userId, pushToken);
  }

  // Step 3: Subscribe to job notifications (push + email)
  const subscribed = await subscribeToJobNotifications(userId, jobId, {
    pushEnabled,
    emailEnabled: true,
    email,
  });

  if (!subscribed) {
    return { success: false, pushEnabled: false, error: 'Failed to subscribe' };
  }

  // Step 4: Also notify backend API to register this subscription
  try {
    await fetch(`${env.CORE_API_URL}/api/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        jobId,
        pushToken: pushToken?.token,
        email,
        pushEnabled,
        emailEnabled: true,
      }),
    });
  } catch (e) {
    // Non-blocking - Supabase subscription is primary
    console.warn('⚠️ Backend notification API call failed (non-blocking)');
  }

  return { success: true, pushEnabled };
}

/**
 * Schedule a local notification (for testing or immediate feedback)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Immediate
    });
    return id;
  } catch (error) {
    console.error('❌ Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Add notification response listener (for handling taps)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (for foreground notifications)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
