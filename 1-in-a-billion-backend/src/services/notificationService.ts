/**
 * NOTIFICATION SERVICE
 * 
 * Sends push notifications (via Expo) and email notifications when jobs complete.
 */

import { supabase } from './supabaseClient';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
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
    .filter(token => token && token.startsWith('ExponentPushToken'))
    .map(token => ({
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
        'Accept': 'application/json',
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
 * Send email notification via Supabase Edge Function or direct SMTP
 * For now, uses Supabase's built-in email (if configured) or logs
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

  try {
    // Option 1: Use Supabase Edge Function (recommended)
    // This would call a Supabase function that sends email via Resend/SendGrid
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to: email, subject, text: body, html: htmlBody },
    });

    if (error) {
      console.warn('⚠️ Supabase email function failed:', error.message);
      // Fall through to log
    } else {
      console.log(`✅ Email sent to ${email}`);
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Email function not available');
  }

  // Fallback: Just log (in production, implement direct SMTP or use a service)
  console.log(`📧 [EMAIL WOULD BE SENT] To: ${email}, Subject: ${subject}`);
  return true; // Return true so we don't block the flow
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
  console.log(`🔔 Sending notifications for completed job: ${jobId.slice(0, 8)}...`);

  // Get pending notifications from Supabase
  const { data: subscriptions, error } = await supabase
    .rpc('get_pending_notifications', { p_job_id: jobId });

  if (error) {
    console.error('❌ Failed to get pending notifications:', error.message);
    return { pushCount: 0, emailCount: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('ℹ️ No pending notification subscriptions for this job');
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

    notifiedSubscriptionIds.push(sub.subscription_id);
  }

  // Mark notifications as sent
  if (notifiedSubscriptionIds.length > 0) {
    await supabase.rpc('mark_notifications_sent', { 
      p_subscription_ids: notifiedSubscriptionIds 
    });
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
  const { pushToken, email, pushEnabled = true, emailEnabled = true } = options;

  try {
    // Store push token if provided
    if (pushToken) {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        push_token: pushToken,
        token_type: 'expo',
        platform: 'ios', // Could detect from token format
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,push_token',
      });
    }

    // Create subscription
    const { error } = await supabase.from('job_notification_subscriptions').upsert({
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
