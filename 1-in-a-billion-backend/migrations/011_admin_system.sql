-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN SYSTEM - ROLE-BASED ACCESS CONTROL & MONITORING
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- This migration creates the admin system infrastructure:
-- - Admin user management with roles (admin, moderator, support)
-- - Permission system for granular access control
-- - User activity tracking
-- - Job monitoring and alerts
-- - Audit logging for security
--
-- Run this in Supabase SQL Editor or via: ts-node src/scripts/applyMigration.ts 011_admin_system.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TYPE admin_role AS ENUM ('admin', 'moderator', 'support');
CREATE TYPE permission_action AS ENUM ('read', 'write', 'delete', 'manage');
CREATE TYPE activity_type AS ENUM ('login', 'reading_generated', 'purchase', 'subscription_change', 'profile_update', 'overlay_created');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_type AS ENUM ('failure', 'timeout', 'cost_threshold', 'queue_backlog', 'api_error');

-- ───────────────────────────────────────────────────────────────────────────
-- ADMIN USERS TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role admin_role NOT NULL DEFAULT 'support',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;

-- ───────────────────────────────────────────────────────────────────────────
-- ADMIN PERMISSIONS TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role admin_role NOT NULL,
  resource TEXT NOT NULL, -- 'users', 'jobs', 'analytics', 'system', 'api_keys', 'subscriptions'
  action permission_action NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- Default permissions
INSERT INTO admin_permissions (role, resource, action) VALUES
  -- Admin: Full access to everything
  ('admin', 'users', 'manage'),
  ('admin', 'jobs', 'manage'),
  ('admin', 'analytics', 'manage'),
  ('admin', 'system', 'manage'),
  ('admin', 'api_keys', 'manage'),
  ('admin', 'subscriptions', 'manage'),
  ('admin', 'admins', 'manage'),
  
  -- Moderator: User & content management
  ('moderator', 'users', 'read'),
  ('moderator', 'users', 'write'),
  ('moderator', 'jobs', 'read'),
  ('moderator', 'content', 'read'),
  ('moderator', 'content', 'write'),
  
  -- Support: Read-only + user assistance
  ('support', 'users', 'read'),
  ('support', 'users', 'write'), -- Can update user info for support
  ('support', 'jobs', 'read'),
  ('support', 'subscriptions', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- USER ACTIVITY TRACKING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- USER NOTES (Support team notes)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admin_users(id),
  note TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notes_flagged ON user_notes(is_flagged) WHERE is_flagged = true;

-- ───────────────────────────────────────────────────────────────────────────
-- SUBSCRIPTION HISTORY
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL, -- 'free', 'basic', 'pro', 'cosmic'
  status TEXT NOT NULL, -- 'active', 'cancelled', 'expired', 'trial'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_tier ON subscription_history(tier, status);

-- ───────────────────────────────────────────────────────────────────────────
-- JOB METRICS (Aggregated statistics)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  job_type TEXT NOT NULL, -- 'hook', 'extended', 'overlay', 'nuclear', 'nuclear_v2'
  status TEXT NOT NULL, -- 'completed', 'failed', 'cancelled', 'pending'
  count INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER,
  total_cost_usd DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, job_type, status)
);

CREATE INDEX IF NOT EXISTS idx_job_metrics_date ON job_metrics(date DESC, job_type);

-- ───────────────────────────────────────────────────────────────────────────
-- JOB ALERTS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_alerts_resolved ON job_alerts(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_job_alerts_severity ON job_alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_alerts_job ON job_alerts(job_id);

-- ───────────────────────────────────────────────────────────────────────────
-- ADMIN AUDIT LOG
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, -- 'user_updated', 'job_cancelled', 'permission_granted', etc.
  resource_type TEXT NOT NULL, -- 'user', 'job', 'subscription', 'admin'
  resource_id UUID,
  changes JSONB, -- Before/after state
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_date ON admin_audit_log(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ───────────────────────────────────────────────────────────────────────────

-- Enable RLS on all admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can see their own record or if they're admin
CREATE POLICY "admin_users_select_own"
  ON admin_users FOR SELECT
  USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Only admins can manage admin users
CREATE POLICY "admin_users_manage_admin_only"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Permissions are readable by all admins
CREATE POLICY "admin_permissions_select"
  ON admin_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Only admins can modify permissions
CREATE POLICY "admin_permissions_manage_admin_only"
  ON admin_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- User notes: admins and moderators can read/write, support can read
CREATE POLICY "user_notes_role_based"
  ON user_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid() AND au.is_active = true
      AND (
        au.role = 'admin' OR
        (au.role = 'moderator' AND action = 'write') OR
        (au.role IN ('moderator', 'support') AND action = 'read')
      )
    )
  );

-- Audit logs: only admins can read
CREATE POLICY "admin_audit_log_admin_only"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ───────────────────────────────────────────────────────────────────────────

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_metrics_updated_at
  BEFORE UPDATE ON job_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check admin permissions
CREATE OR REPLACE FUNCTION check_admin_permission(
  p_admin_id UUID,
  p_resource TEXT,
  p_action permission_action
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role admin_role;
BEGIN
  -- Get admin role
  SELECT role INTO v_role
  FROM admin_users
  WHERE id = p_admin_id AND is_active = true;
  
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if permission exists
  RETURN EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE role = v_role
    AND resource = p_resource
    AND (
      action = p_action OR
      action = 'manage' -- manage includes all actions
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- 1. After running this migration, create your first admin user:
--    INSERT INTO admin_users (id, email, full_name, role)
--    VALUES ('<user-uuid-from-auth.users>', 'admin@example.com', 'Admin User', 'admin');
--
-- 2. The check_admin_permission function can be called from your backend:
--    SELECT check_admin_permission('admin-uuid', 'users', 'read');
--
-- 3. All tables have RLS enabled - make sure your service role key has
--    appropriate access or use service role for admin operations.
-- ═══════════════════════════════════════════════════════════════════════════

