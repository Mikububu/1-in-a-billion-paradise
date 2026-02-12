/**
 * NOTIFICATION SERVICE
 *
 * Sends push notifications (via Expo) and email notifications.
 */

import { supabase } from './supabaseClient';
import { Resend } from 'resend';
import { getApiKey } from './apiKeys';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EMAIL_FROM = '1 In A Billion <noreply@oneinabillion.app>';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export type PushTokenType = 'expo' | 'apns' | 'fcm';
export type PushTokenPlatform = 'ios' | 'android' | 'web';

export interface MatchNotificationPreference {
  userId: string;
  matchAlertsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  consentAskedAt: string | null;
  consentSource: string | null;
  firstMatchNotifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const DEFAULT_MATCH_NOTIFICATION_PREFERENCE: Omit<MatchNotificationPreference, 'userId'> = {
  matchAlertsEnabled: false,
  emailEnabled: false,
  pushEnabled: false,
  consentAskedAt: null,
  consentSource: null,
  firstMatchNotifiedAt: null,
  createdAt: null,
  updatedAt: null,
};

export interface FirstMatchNotificationOutcome {
  userId: string;
  sent: boolean;
  pushSent: boolean;
  emailSent: boolean;
  reason?:
    | 'supabase_unavailable'
    | 'not_first_match'
    | 'no_preferences'
    | 'disabled'
    | 'already_notified'
    | 'no_deliverable_channel'
    | 'claim_failed';
}

function toMatchPreferenceRow(row: any | null): MatchNotificationPreference | null {
  if (!row?.user_id) return null;
  return {
    userId: row.user_id,
    matchAlertsEnabled: row.match_alerts_enabled === true,
    emailEnabled: row.email_enabled === true,
    pushEnabled: row.push_enabled === true,
    consentAskedAt: row.consent_asked_at || null,
    consentSource: row.consent_source || null,
    firstMatchNotifiedAt: row.first_match_notified_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**
 * Send Expo push notification to multiple tokens
 */
export async function sendExpoPushNotifications(
  pushTokens: string[],
  payload: NotificationPayload
): Promise<{ success: boolean; results: any[] }> {
  if (!pushTokens || pushTokens.length === 0) {
    return { success: true, results: [] };
  }

  const messages = pushTokens
    .filter((token) => token && token.startsWith('ExponentPushToken'))
    .map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    }));

  if (messages.length === 0) {
    console.log('⚠️ No valid Expo push tokens to send to');
    return { success: true, results: [] };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`✅ Sent ${messages.length} push notifications`);
    return { success: true, results: result.data || [] };
  } catch (error) {
    console.error('❌ Failed to send push notifications:', error);
    return { success: false, results: [] };
  }
}

/**
 * Send email notification via Resend
 * Falls back to logging if Resend is not configured
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  body: string,
  htmlBody?: string
): Promise<boolean> {
  if (!email) {
    console.log('⚠️ No email address provided');
    return false;
  }

  // Get Resend API key from Supabase
  const resendApiKey = await getApiKey('resend');

  if (!resendApiKey) {
    console.warn('⚠️ Resend API key not found. Email will not be sent.');
    console.log(`📧 [EMAIL WOULD BE SENT] To: ${email}, Subject: ${subject}`);
    return true; // Return true so we don't block the flow
  }

  try {
    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      text: body,
      html: htmlBody || body.replace(/\n/g, '<br>'),
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      return false;
    }

    if (data?.id) {
      console.log(`✅ Email sent to ${email} (Resend ID: ${data.id})`);
      return true;
    }

    console.warn('⚠️ Resend returned no error but no email ID');
    return false;
  } catch (err: any) {
    console.error('❌ Exception sending email via Resend:', err.message);
    return false;
  }
}

/**
 * Upsert a user push token.
 */
export async function upsertUserPushToken(params: {
  userId: string;
  pushToken: string;
  tokenType?: PushTokenType;
  platform?: PushTokenPlatform;
}): Promise<boolean> {
  if (!supabase) return false;

  const token = (params.pushToken || '').trim();
  if (!params.userId || !token) return false;

  try {
    const { error } = await supabase.from('user_push_tokens').upsert(
      {
        user_id: params.userId,
        push_token: token,
        token_type: params.tokenType || 'expo',
        platform: params.platform || 'ios',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,push_token',
      }
    );

    if (error) {
      console.error('❌ Failed to upsert push token:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Exception in upsertUserPushToken:', err);
    return false;
  }
}

/**
 * Get current per-user match notification preference row.
 */
export async function getMatchNotificationPreference(userId: string): Promise<MatchNotificationPreference | null> {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('user_match_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Failed to load match notification preference:', error.message);
      return null;
    }

    return toMatchPreferenceRow(data);
  } catch (err) {
    console.warn('⚠️ Exception loading match notification preference:', err);
    return null;
  }
}

/**
 * Upsert user match notification consent/preferences.
 */
export async function upsertMatchNotificationPreference(params: {
  userId: string;
  enabled: boolean;
  source?: string | null;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  markAsked?: boolean;
  pushToken?: string;
  tokenType?: PushTokenType;
  platform?: PushTokenPlatform;
}): Promise<MatchNotificationPreference | null> {
  if (!supabase || !params.userId) return null;

  const now = new Date().toISOString();
  const effectiveEmailEnabled = params.emailEnabled ?? params.enabled;
  const effectivePushEnabled = params.pushEnabled ?? params.enabled;

  if (params.pushToken && params.enabled) {
    await upsertUserPushToken({
      userId: params.userId,
      pushToken: params.pushToken,
      tokenType: params.tokenType,
      platform: params.platform,
    });
  }

  try {
    const { data, error } = await supabase
      .from('user_match_notification_preferences')
      .upsert(
        {
          user_id: params.userId,
          match_alerts_enabled: params.enabled,
          email_enabled: effectiveEmailEnabled,
          push_enabled: effectivePushEnabled,
          consent_source: params.source || null,
          consent_asked_at: params.markAsked === false ? null : now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('❌ Failed to upsert match notification preference:', error.message);
      return null;
    }

    return toMatchPreferenceRow(data);
  } catch (err) {
    console.error('❌ Exception upserting match notification preference:', err);
    return null;
  }
}

async function resolveUserEmailForNotifications(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null;

  try {
    const { data: profile } = await supabase
      .from('library_people')
      .select('email')
      .eq('user_id', userId)
      .eq('is_user', true)
      .maybeSingle();

    const profileEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
    if (profileEmail) return profileEmail;

    const { data: subscriptionRows } = await supabase
      .from('user_subscriptions')
      .select('email')
      .eq('user_id', userId)
      .not('email', 'is', null)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const subscriptionEmail = typeof subscriptionRows?.[0]?.email === 'string'
      ? subscriptionRows[0].email.trim()
      : '';
    if (subscriptionEmail) return subscriptionEmail;

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);
    if (!authUserError) {
      const authEmail = typeof authUserData?.user?.email === 'string' ? authUserData.user.email.trim() : '';
      if (authEmail) return authEmail;
    }

    return null;
  } catch {
    return null;
  }
}

async function notifyUserOnFirstMatch(params: {
  userId: string;
  matchId: string;
  otherName?: string | null;
}): Promise<FirstMatchNotificationOutcome> {
  const outcomeBase: FirstMatchNotificationOutcome = {
    userId: params.userId,
    sent: false,
    pushSent: false,
    emailSent: false,
  };

  if (!supabase) {
    return { ...outcomeBase, reason: 'supabase_unavailable' };
  }

  const preference = await getMatchNotificationPreference(params.userId);
  if (!preference) {
    return { ...outcomeBase, reason: 'no_preferences' };
  }

  if (!preference.matchAlertsEnabled) {
    return { ...outcomeBase, reason: 'disabled' };
  }

  if (preference.firstMatchNotifiedAt) {
    return { ...outcomeBase, reason: 'already_notified' };
  }

  const { count, error: countError } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`user1_id.eq.${params.userId},user2_id.eq.${params.userId}`);

  if (countError) {
    console.warn('⚠️ Failed to verify first-match count:', countError.message);
    return { ...outcomeBase, reason: 'not_first_match' };
  }

  if ((count || 0) !== 1) {
    return { ...outcomeBase, reason: 'not_first_match' };
  }

  const email = preference.emailEnabled ? await resolveUserEmailForNotifications(params.userId) : null;
  let pushTokens: string[] = [];

  if (preference.pushEnabled) {
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', params.userId);

    pushTokens = (tokens || [])
      .map((row: any) => row?.push_token)
      .filter((token: any): token is string => typeof token === 'string' && token.length > 0);
  }

  if (!email && pushTokens.length === 0) {
    return { ...outcomeBase, reason: 'no_deliverable_channel' };
  }

  const now = new Date().toISOString();
  const { data: claimRow, error: claimError } = await supabase
    .from('user_match_notification_preferences')
    .update({
      first_match_notified_at: now,
      updated_at: now,
    })
    .eq('user_id', params.userId)
    .eq('match_alerts_enabled', true)
    .is('first_match_notified_at', null)
    .select('user_id')
    .maybeSingle();

  if (claimError || !claimRow) {
    return { ...outcomeBase, reason: 'claim_failed' };
  }

  const title = 'We found a match for you';
  const body = params.otherName
    ? `${params.otherName} resonated with your chart. Open the app to see your match.`
    : 'A new soul resonance appeared. Open the app to see your match.';

  let pushSent = false;
  let emailSent = false;

  if (pushTokens.length > 0) {
    const pushResult = await sendExpoPushNotifications(pushTokens, {
      title,
      body,
      data: {
        screen: 'Gallery',
        matchId: params.matchId,
        event: 'first_match',
      },
    });
    pushSent = pushResult.success;
  }

  if (email) {
    emailSent = await sendEmailNotification(
      email,
      title,
      body,
      `<h2>${title}</h2><p>${body}</p><p><a href="oneinabillion://gallery">Open your matches</a></p>`
    );
  }

  return {
    userId: params.userId,
    sent: pushSent || emailSent,
    pushSent,
    emailSent,
  };
}

/**
 * Send first-match notifications (once per user, consent-gated).
 */
export async function notifyFirstMatchForUsers(params: {
  matchId: string;
  userIds: string[];
  otherNamesByUserId?: Record<string, string | null | undefined>;
}): Promise<FirstMatchNotificationOutcome[]> {
  const outcomes: FirstMatchNotificationOutcome[] = [];
  const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)));

  for (const userId of uniqueUserIds) {
    const otherName = params.otherNamesByUserId?.[userId] || null;
    const outcome = await notifyUserOnFirstMatch({
      userId,
      matchId: params.matchId,
      otherName,
    });
    outcomes.push(outcome);
  }

  return outcomes;
}

/**
 * Send notifications for a completed job
 */
export async function notifyJobComplete(
  jobId: string,
  jobInfo: {
    personName?: string;
    systemName?: string;
    type?: string;
  }
): Promise<{ pushCount: number; emailCount: number }> {
  if (!supabase) return { pushCount: 0, emailCount: 0 };

  console.log(`🔔 Sending notifications for completed job: ${jobId.slice(0, 8)}...`);

  // Get pending notifications from Supabase
  let subscriptions: any[] = [];
  let error: any = null;

  try {
    const result = await supabase.rpc('get_pending_notifications', { p_job_id: jobId });
    error = result.error;
    subscriptions = result.data || [];
  } catch {
    // Function might not exist - that's OK, we'll use fallback
    console.warn('⚠️ get_pending_notifications function not available, using fallback');
  }

  // FALLBACK: If subscription table doesn't exist, get user email directly from job
  if (error || !subscriptions || subscriptions.length === 0) {
    console.log('ℹ️ No subscription table or subscriptions found, trying fallback email lookup...');

    try {
      // Get job to find user_id
      const { data: job } = await supabase
        .from('jobs')
        .select('user_id, params')
        .eq('id', jobId)
        .single();

      if (job?.user_id) {
        // Get user email from library_people
        const { data: userProfile } = await supabase
          .from('library_people')
          .select('email')
          .eq('user_id', job.user_id)
          .eq('is_user', true)
          .single();

        if (userProfile?.email) {
          // Create a fallback subscription object
          subscriptions = [
            {
              subscription_id: null,
              user_id: job.user_id,
              push_enabled: false,
              email_enabled: true,
              email: userProfile.email,
              push_tokens: [],
            },
          ];
          console.log(`✅ Found user email via fallback: ${userProfile.email}`);
        }
      }
    } catch (fallbackError: any) {
      console.warn('⚠️ Fallback email lookup failed:', fallbackError.message);
    }
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('ℹ️ No way to send notifications for this job');
    return { pushCount: 0, emailCount: 0 };
  }

  let pushCount = 0;
  let emailCount = 0;
  const notifiedSubscriptionIds: string[] = [];

  // Build notification content
  const title = '🎉 Your Reading is Ready!';
  const body = jobInfo.personName
    ? `${jobInfo.personName}'s ${jobInfo.systemName || 'reading'} is complete and waiting for you.`
    : `Your ${jobInfo.systemName || 'reading'} is ready to explore!`;

  for (const sub of subscriptions) {
    // Send push notification
    if (sub.push_enabled && sub.push_tokens && sub.push_tokens.length > 0) {
      const pushResult = await sendExpoPushNotifications(sub.push_tokens, {
        title,
        body,
        data: { jobId, screen: 'PersonReadings' },
      });
      if (pushResult.success) {
        pushCount += sub.push_tokens.length;
      }
    }

    // Send email notification
    if (sub.email_enabled && sub.email) {
      const emailSent = await sendEmailNotification(
        sub.email,
        title,
        body,
        `<h2>${title}</h2><p>${body}</p><p><a href="1inabillion://job/${jobId}">Open in App</a></p>`
      );
      if (emailSent) {
        emailCount++;
      }
    }

    // Only track subscription IDs that exist (fallback subscriptions have null IDs)
    if (sub.subscription_id) {
      notifiedSubscriptionIds.push(sub.subscription_id);
    }
  }

  // Mark notifications as sent (only if we have real subscription IDs)
  if (notifiedSubscriptionIds.length > 0) {
    try {
      await supabase.rpc('mark_notifications_sent', {
        p_subscription_ids: notifiedSubscriptionIds,
      });
    } catch {
      // Function might not exist - that's OK for fallback mode
      console.warn('⚠️ Could not mark notifications as sent (non-blocking)');
    }
  }

  console.log(`✅ Notifications sent: ${pushCount} push, ${emailCount} email`);
  return { pushCount, emailCount };
}

/**
 * Subscribe a user to job notifications
 */
export async function subscribeToNotifications(
  userId: string,
  jobId: string,
  options: {
    pushToken?: string;
    email?: string;
    pushEnabled?: boolean;
    emailEnabled?: boolean;
  }
): Promise<boolean> {
  if (!supabase) return false;

  const { pushToken, email, pushEnabled = true, emailEnabled = true } = options;

  try {
    // Store push token if provided
    if (pushToken) {
      await upsertUserPushToken({
        userId,
        pushToken,
        tokenType: 'expo',
        platform: 'ios',
      });
    }

    // Create subscription
    const { error } = await supabase.from('job_notification_subscriptions').upsert(
      {
        user_id: userId,
        job_id: jobId,
        push_enabled: pushEnabled,
        email_enabled: emailEnabled,
        email: email || null,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,job_id',
      }
    );

    if (error) {
      console.error('❌ Failed to create notification subscription:', error.message);
      return false;
    }

    console.log(`✅ User ${userId.slice(0, 8)} subscribed to notifications for job ${jobId.slice(0, 8)}`);
    return true;
  } catch (err) {
    console.error('❌ Exception in subscribeToNotifications:', err);
    return false;
  }
}
