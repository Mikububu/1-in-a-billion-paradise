"use strict";
/**
 * ADMIN AUTHENTICATION MIDDLEWARE
 *
 * Validates admin JWT tokens and checks permissions for admin routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
exports.requirePermission = requirePermission;
exports.getAdmin = getAdmin;
exports.logAdminAction = logAdminAction;
const supabaseClient_1 = require("../services/supabaseClient");
/**
 * Extract Bearer token from Authorization header
 */
function getBearerToken(c) {
    const auth = c.req.header('Authorization') || c.req.header('authorization');
    if (!auth)
        return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}
/**
 * Verify admin user from JWT token
 */
async function verifyAdminUser(token) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return null;
    try {
        // Verify token and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user)
            return null;
        // Check if user is an admin
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('id, email, full_name, role, is_active')
            .eq('id', user.id)
            .eq('is_active', true)
            .single();
        if (adminError || !adminUser)
            return null;
        return adminUser;
    }
    catch (err) {
        console.error('Admin auth error:', err);
        return null;
    }
}
/**
 * Check if admin has permission for a resource/action
 */
async function checkPermission(adminId, resource, action) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return false;
    try {
        // Get admin role
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('role')
            .eq('id', adminId)
            .eq('is_active', true)
            .single();
        if (!adminUser)
            return false;
        // Check permission (either exact match or 'manage' which grants all)
        const { data: permission, error } = await supabase
            .from('admin_permissions')
            .select('id')
            .eq('role', adminUser.role)
            .eq('resource', resource)
            .or(`action.eq.${action},action.eq.manage`)
            .limit(1)
            .single();
        return !error && !!permission;
    }
    catch (err) {
        console.error('Permission check error:', err);
        return false;
    }
}
/**
 * Middleware to require admin authentication
 */
async function requireAdminAuth(c, next) {
    const token = getBearerToken(c);
    if (!token) {
        return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }
    const admin = await verifyAdminUser(token);
    if (!admin) {
        return c.json({ error: 'Unauthorized: Invalid or inactive admin token' }, 401);
    }
    // Attach admin to context
    c.set('admin', admin);
    c.set('hasPermission', (resource, action) => checkPermission(admin.id, resource, action));
    await next();
}
/**
 * Middleware to require specific permission
 */
function requirePermission(resource, action) {
    return async (c, next) => {
        const admin = c.get('admin');
        const hasPermission = c.get('hasPermission');
        if (!admin || !hasPermission) {
            return c.json({ error: 'Unauthorized: Admin context missing' }, 401);
        }
        const allowed = await hasPermission(resource, action);
        if (!allowed) {
            return c.json({
                error: 'Forbidden: Insufficient permissions',
                required: { resource, action }
            }, 403);
        }
        await next();
    };
}
/**
 * Helper to get admin from context
 */
function getAdmin(c) {
    return c.get('admin') || null;
}
/**
 * Helper to log admin action to audit log
 */
async function logAdminAction(adminId, action, resourceType, resourceId, changes, ipAddress, userAgent) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return;
    try {
        await supabase.from('admin_audit_log').insert({
            admin_id: adminId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
            ip_address: ipAddress || null,
            user_agent: userAgent || null,
        });
    }
    catch (err) {
        console.error('Failed to log admin action:', err);
        // Don't throw - audit logging failure shouldn't break the request
    }
}
//# sourceMappingURL=adminAuth.js.map