import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { env } from '@/config/env';

export type MatchNotificationPreferences = {
  userId: string;
  matchAlertsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  consentAskedAt: string | null;
  consentSource: string | null;
  firstMatchNotifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const DEFAULT_PREFERENCES = {
  matchAlertsEnabled: false,
  emailEnabled: false,
  pushEnabled: false,
  consentAskedAt: null,
  consentSource: null,
  firstMatchNotifiedAt: null,
  createdAt: null,
  updatedAt: null,
};

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizePreferences(userId: string, input: any): MatchNotificationPreferences {
  return {
    userId,
    matchAlertsEnabled: input?.matchAlertsEnabled === true,
    emailEnabled: input?.emailEnabled === true,
    pushEnabled: input?.pushEnabled === true,
    consentAskedAt: input?.consentAskedAt || null,
    consentSource: input?.consentSource || null,
    firstMatchNotifiedAt: input?.firstMatchNotifiedAt || null,
    createdAt: input?.createdAt || null,
    updatedAt: input?.updatedAt || null,
  };
}

export async function getMatchNotificationPreferences(
  userId: string
): Promise<MatchNotificationPreferences> {
  if (!userId) {
    return normalizePreferences('', DEFAULT_PREFERENCES);
  }

  try {
    const response = await fetchWithTimeout(`${env.CORE_API_URL}/api/notifications/preferences/match`, {
      headers: {
        'X-User-Id': userId,
      },
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.success) {
      return normalizePreferences(userId, DEFAULT_PREFERENCES);
    }

    return normalizePreferences(userId, json.preferences || DEFAULT_PREFERENCES);
  } catch {
    return normalizePreferences(userId, DEFAULT_PREFERENCES);
  }
}

async function requestPushTokenIfAvailable(): Promise<{
  token: string | null;
  tokenType: 'expo';
  platform: 'ios' | 'android' | 'web';
}> {
  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';

  try {
    // Keep this dynamic so the app can still run in environments without expo-notifications installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { token: null, tokenType: 'expo', platform };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      env.EXPO_PROJECT_ID ||
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = typeof tokenData?.data === 'string' ? tokenData.data : null;
    return { token, tokenType: 'expo', platform };
  } catch {
    return { token: null, tokenType: 'expo', platform };
  }
}

export async function updateMatchNotificationPreferences(params: {
  userId: string;
  enabled: boolean;
  source: 'post_signup_prompt' | 'settings';
}): Promise<MatchNotificationPreferences | null> {
  const { userId, enabled, source } = params;
  if (!userId) return null;

  const push = enabled
    ? await requestPushTokenIfAvailable()
    : {
        token: null,
        tokenType: 'expo' as const,
        platform: (Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios') as
          | 'ios'
          | 'android'
          | 'web',
      };

  try {
    const response = await fetchWithTimeout(`${env.CORE_API_URL}/api/notifications/preferences/match`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        enabled,
        source,
        // Product decision: one combined toggle in UI, but still keep channel flags in backend.
        emailEnabled: enabled,
        pushEnabled: enabled && Boolean(push.token),
        pushToken: push.token,
        tokenType: push.tokenType,
        platform: push.platform,
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.success) {
      return null;
    }

    return normalizePreferences(userId, json.preferences || DEFAULT_PREFERENCES);
  } catch {
    return null;
  }
}
