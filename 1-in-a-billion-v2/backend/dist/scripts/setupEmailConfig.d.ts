/**
 * EMAIL CONFIGURATION SETUP SCRIPT
 *
 * This script helps configure Supabase email settings.
 * Note: Most email settings must be configured via Supabase Dashboard,
 * but this script provides the exact values and validates the setup.
 */
declare const EMAIL_CONFIG: {
    senderEmail: string;
    senderName: string;
    frontendUrl: string;
    redirectUrls: string[];
};
/**
 * Email Templates Configuration
 */
declare const EMAIL_TEMPLATES: {
    signup: {
        subject: string;
        body: string;
    };
    resetPassword: {
        subject: string;
        body: string;
    };
    magicLink: {
        subject: string;
        body: string;
    };
};
export { EMAIL_CONFIG, EMAIL_TEMPLATES };
//# sourceMappingURL=setupEmailConfig.d.ts.map