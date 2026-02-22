/**
 * ADMIN AUTHENTICATION MIDDLEWARE
 * 
 * Validates admin JWT tokens and checks permissions for admin routes.
 */

import { Context, Next } from 'hono';
import { createSupabaseServiceClient } from '../services/supabaseClient';

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
 * Extract Bearer token from Authorization header
 */
function getBearerToken(c: Context): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Verify admin user from JWT token
 */
async function verifyAdminUser(token: string): Promise<AdminUser | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  try {
    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return null;

    // Check if user is an admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser) return null;

    return adminUser as AdminUser;
  } catch (err) {
    console.error('Admin auth error:', err);
    return null;
  }
}

/**
 * Check if admin has permission for a resource/action
 */
async function checkPermission(
  adminId: string,
  resource: string,
  action: 'read' | 'write' | 'delete' | 'manage'
): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  try {
    // Get admin role
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', adminId)
      .eq('is_active', true)
      .single();

    if (!adminUser) return false;

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
  } catch (err) {
    console.error('Permission check error:', err);
    return false;
  }
}

/**
 * Middleware to require admin authentication
 */
export async function requireAdminAuth(c: Context, next: Next) {
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
  c.set('hasPermission', (resource: string, action: 'read' | 'write' | 'delete' | 'manage') => 
    checkPermission(admin.id, resource, action)
  );

  await next();
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(resource: string, action: 'read' | 'write' | 'delete' | 'manage') {
  return async (c: Context, next: Next) => {
    const admin = c.get('admin') as AdminUser | undefined;
    const hasPermission = c.get('hasPermission') as ((resource: string, action: string) => Promise<boolean>) | undefined;

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
export function getAdmin(c: Context): AdminUser | null {
  return c.get('admin') || null;
}

/**
 * Helper to log admin action to audit log
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  changes: Record<string, any> | null,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

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
  } catch (err) {
    console.error('Failed to log admin action:', err);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

