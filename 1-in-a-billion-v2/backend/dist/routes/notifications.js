"use strict";
/**
 * NOTIFICATIONS API ROUTES
 *
 * Handles push notification subscriptions and manual notification triggers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const notificationService_1 = require("../services/notificationService");
const requireAuth_1 = require("../middleware/requireAuth");
const adminAuth_1 = require("../middleware/adminAuth");
const app = new hono_1.Hono();
/**
 * POST /api/notifications/subscribe
 * Subscribe to notifications for a job
 */
app.post('/subscribe', requireAuth_1.requireAuth, async (c) => {
    try {
        const body = await c.req.json();
        const { jobId, pushToken, email, pushEnabled, emailEnabled } = body;
        // Use authenticated userId from JWT token instead of request body
        const userId = c.get('userId');
        if (!userId || !jobId) {
            return c.json({ success: false, error: 'Missing userId or jobId' }, 400);
        }
        const success = await (0, notificationService_1.subscribeToNotifications)(userId, jobId, {
            pushToken,
            email,
            pushEnabled: pushEnabled !== false,
            emailEnabled: emailEnabled !== false,
        });
        return c.json({ success });
    }
    catch (error) {
        console.error('❌ Error in /notifications/subscribe:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
/**
 * POST /api/notifications/send
 * Manually trigger notifications for a job (admin/testing)
 */
app.post('/send', adminAuth_1.requireAdminAuth, async (c) => {
    try {
        const body = await c.req.json();
        const { jobId, personName, systemName, type } = body;
        if (!jobId) {
            return c.json({ success: false, error: 'Missing jobId' }, 400);
        }
        const result = await (0, notificationService_1.notifyJobComplete)(jobId, { personName, systemName, type });
        return c.json({
            success: true,
            pushCount: result.pushCount,
            emailCount: result.emailCount,
        });
    }
    catch (error) {
        console.error('❌ Error in /notifications/send:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
exports.default = app;
//# sourceMappingURL=notifications.js.map