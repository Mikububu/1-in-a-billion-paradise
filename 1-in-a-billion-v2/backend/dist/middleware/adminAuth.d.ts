/**
 * ADMIN AUTHENTICATION MIDDLEWARE
 *
 * Validates admin JWT tokens and checks permissions for admin routes.
 */
import { Context, Next } from 'hono';
export interface AdminUser {
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'moderator' | 'support';
    is_active: boolean;
}
export interface AdminContext {
    admin: AdminUser;
    hasPermission: (resource: string, action: 'read' | 'write' | 'delete' | 'manage') => Promise<boolean>;
}
/**
 * Middleware to require admin authentication
 */
export declare function requireAdminAuth(c: Context, next: Next): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">) | undefined>;
/**
 * Middleware to require specific permission
 */
export declare function requirePermission(resource: string, action: 'read' | 'write' | 'delete' | 'manage'): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    required: {
        resource: string;
        action: "delete" | "write" | "read" | "manage";
    };
}, 403, "json">) | undefined>;
/**
 * Helper to get admin from context
 */
export declare function getAdmin(c: Context): AdminUser | null;
/**
 * Helper to log admin action to audit log
 */
export declare function logAdminAction(adminId: string, action: string, resourceType: string, resourceId: string | null | undefined, changes: Record<string, any> | null, ipAddress?: string, userAgent?: string): Promise<void>;
//# sourceMappingURL=adminAuth.d.ts.map