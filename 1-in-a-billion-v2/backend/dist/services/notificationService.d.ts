/**
 * NOTIFICATION SERVICE
 *
 * Sends push notifications (via Expo) and email notifications when jobs complete.
 */
export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
}
/**
 * Send Expo push notification to multiple tokens
 */
export declare function sendExpoPushNotifications(pushTokens: string[], payload: NotificationPayload): Promise<{
    success: boolean;
    results: any[];
}>;
/**
 * Send email notification via Resend
 * Falls back to logging if Resend is not configured
 */
export declare function sendEmailNotification(email: string, subject: string, body: string, htmlBody?: string): Promise<boolean>;
/**
 * Send notifications for a completed job
 */
export declare function notifyJobComplete(jobId: string, jobInfo: {
    personName?: string;
    systemName?: string;
    type?: string;
}): Promise<{
    pushCount: number;
    emailCount: number;
}>;
/**
 * Subscribe a user to job notifications
 */
export declare function subscribeToNotifications(userId: string, jobId: string, options: {
    pushToken?: string;
    email?: string;
    pushEnabled?: boolean;
    emailEnabled?: boolean;
}): Promise<boolean>;
//# sourceMappingURL=notificationService.d.ts.map