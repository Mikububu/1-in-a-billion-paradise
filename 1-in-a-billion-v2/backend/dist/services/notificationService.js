"use strict";
/**
 * NOTIFICATION SERVICE
 *
 * Sends push notifications (via Expo) and email notifications when jobs complete.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExpoPushNotifications = sendExpoPushNotifications;
exports.sendEmailNotification = sendEmailNotification;
exports.notifyJobComplete = notifyJobComplete;
exports.subscribeToNotifications = subscribeToNotifications;
const supabaseClient_1 = require("./supabaseClient");
const resend_1 = require("resend");
const apiKeys_1 = require("./apiKeys");
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EMAIL_FROM = '1 In A Billion <noreply@1-in-a-billion.app>';
/**
 * Send Expo push notification to multiple tokens
 */
async function sendExpoPushNotifications(pushTokens, payload) {
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
    }
    catch (error) {
        console.error('❌ Failed to send push notifications:', error);
        return { success: false, results: [] };
    }
}
/**
 * Send email notification via Resend
 * Falls back to logging if Resend is not configured
 */
async function sendEmailNotification(email, subject, body, htmlBody) {
    if (!email) {
        console.log('⚠️ No email address provided');
        return false;
    }
    // Get Resend API key from Supabase
    const resendApiKey = await (0, apiKeys_1.getApiKey)('resend');
    if (!resendApiKey) {
        console.warn('⚠️ Resend API key not found. Email will not be sent.');
        console.log(`📧 [EMAIL WOULD BE SENT] To: ${email}, Subject: ${subject}`);
        return true; // Return true so we don't block the flow
    }
    try {
        const resend = new resend_1.Resend(resendApiKey);
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: subject,
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
    }
    catch (err) {
        console.error('❌ Exception sending email via Resend:', err.message);
        return false;
    }
}
/**
 * Send notifications for a completed job
 */
async function notifyJobComplete(jobId, jobInfo) {
    console.log(`🔔 Sending notifications for completed job: ${jobId.slice(0, 8)}...`);
    // Get pending notifications from Supabase
    let subscriptions = [];
    let error = null;
    try {
        const result = await supabaseClient_1.supabase.rpc('get_pending_notifications', { p_job_id: jobId });
        error = result.error;
        subscriptions = result.data || [];
    }
    catch (e) {
        // Function might not exist - that's OK, we'll use fallback
        console.warn('⚠️ get_pending_notifications function not available, using fallback');
    }
    // FALLBACK: If subscription table doesn't exist, get user email directly from job
    if (error || !subscriptions || subscriptions.length === 0) {
        console.log('ℹ️ No subscription table or subscriptions found, trying fallback email lookup...');
        try {
            // Get job to find user_id
            const { data: job } = await supabaseClient_1.supabase
                .from('jobs')
                .select('user_id, params')
                .eq('id', jobId)
                .single();
            if (job?.user_id) {
                // Get user email from library_people
                const { data: userProfile } = await supabaseClient_1.supabase
                    .from('library_people')
                    .select('email')
                    .eq('user_id', job.user_id)
                    .eq('is_user', true)
                    .single();
                if (userProfile?.email) {
                    // Create a fallback subscription object
                    subscriptions = [{
                            subscription_id: null,
                            user_id: job.user_id,
                            push_enabled: false,
                            email_enabled: true,
                            email: userProfile.email,
                            push_tokens: [],
                        }];
                    console.log(`✅ Found user email via fallback: ${userProfile.email}`);
                }
            }
        }
        catch (fallbackError) {
            console.warn('⚠️ Fallback email lookup failed:', fallbackError.message);
        }
    }
    if (!subscriptions || subscriptions.length === 0) {
        console.log('ℹ️ No way to send notifications for this job');
        return { pushCount: 0, emailCount: 0 };
    }
    let pushCount = 0;
    let emailCount = 0;
    const notifiedSubscriptionIds = [];
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
            const emailSent = await sendEmailNotification(sub.email, title, body, `<h2>${title}</h2><p>${body}</p><p><a href="1inabillion://job/${jobId}">Open in App</a></p>`);
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
            await supabaseClient_1.supabase.rpc('mark_notifications_sent', {
                p_subscription_ids: notifiedSubscriptionIds
            });
        }
        catch (e) {
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
async function subscribeToNotifications(userId, jobId, options) {
    const { pushToken, email, pushEnabled = true, emailEnabled = true } = options;
    try {
        // Store push token if provided
        if (pushToken) {
            await supabaseClient_1.supabase.from('user_push_tokens').upsert({
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
        const { error } = await supabaseClient_1.supabase.from('job_notification_subscriptions').upsert({
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
    }
    catch (err) {
        console.error('❌ Exception in subscribeToNotifications:', err);
        return false;
    }
}
//# sourceMappingURL=notificationService.js.map