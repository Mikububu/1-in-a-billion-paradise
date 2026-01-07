# ADMIN SYSTEM ARCHITECTURE

## Overview
Comprehensive admin system for managing users, monitoring jobs, and overseeing the entire 1-in-a-billion platform.

---

## TECH STACK RECOMMENDATION

### Backend
- **Framework**: Hono.js (extend existing backend)
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth + JWT
- **API**: RESTful + WebSocket for real-time updates

### Frontend (Admin Panel)
- **Framework**: Next.js 14 (App Router) + React 18
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand (or React Query for server state)
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table (React Table)
- **Real-time**: Supabase Realtime subscriptions

### Infrastructure
- **Hosting**: Vercel (frontend) + existing backend
- **Monitoring**: Supabase logs + custom analytics
- **File Storage**: Supabase Storage (for exports/reports)

---

## SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN WEB PANEL (Next.js)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Dashboard│  │  Users   │  │   Jobs    │  │ Analytics │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS + JWT
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ADMIN API (Hono.js Backend)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ /admin/  │  │ /admin/  │  │ /admin/  │  │ /admin/  │   │
│  │  users   │  │  jobs    │  │  system  │  │  reports │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL + RLS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  users   │  │   jobs   │  │  admin_  │  │  audit_  │   │
│  │          │  │          │  │  roles    │  │  logs    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## DATABASE SCHEMA

### 1. Admin Roles & Permissions

```sql
-- Admin users table (extends auth.users)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'support')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'support')),
  resource TEXT NOT NULL, -- 'users', 'jobs', 'analytics', etc.
  action TEXT NOT NULL, -- 'read', 'write', 'delete', 'manage'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default permissions
INSERT INTO admin_permissions (role, resource, action) VALUES
  -- Admin: Full access
  ('admin', 'users', 'manage'),
  ('admin', 'jobs', 'manage'),
  ('admin', 'analytics', 'manage'),
  ('admin', 'system', 'manage'),
  ('admin', 'api_keys', 'manage'),
  ('admin', 'subscriptions', 'manage'),
  
  -- Moderator: User & content management
  ('moderator', 'users', 'write'),
  ('moderator', 'users', 'read'),
  ('moderator', 'jobs', 'read'),
  ('moderator', 'content', 'write'),
  
  -- Support: Read-only + user assistance
  ('support', 'users', 'read'),
  ('support', 'jobs', 'read'),
  ('support', 'users', 'write'); -- Can update user info for support
```

### 2. User Management Extensions

```sql
-- User activity tracking
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'login', 'reading_generated', 'purchase', etc.
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User flags/notes (for support)
CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admin_users(id),
  note TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscription history
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL, -- 'free', 'basic', 'pro', 'cosmic'
  status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Job Monitoring Extensions

```sql
-- Job metrics (aggregated from jobs table)
CREATE TABLE job_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  job_type TEXT NOT NULL, -- 'hook', 'extended', 'overlay', 'nuclear'
  status TEXT NOT NULL, -- 'completed', 'failed', 'pending'
  count INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER,
  total_cost_usd DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, job_type, status)
);

-- Job alerts (for monitoring)
CREATE TABLE job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'failure', 'timeout', 'cost_threshold'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Audit Logging

```sql
-- Admin action audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, -- 'user_updated', 'job_cancelled', 'permission_granted'
  resource_type TEXT NOT NULL, -- 'user', 'job', 'subscription'
  resource_id UUID,
  changes JSONB, -- Before/after state
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast queries
CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_resource ON admin_audit_log(resource_type, resource_id);
```

### 5. RLS Policies

```sql
-- Enable RLS on all admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can only see their own record (unless admin)
CREATE POLICY "admin_users_select_own"
  ON admin_users FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Only admins can manage admin users
CREATE POLICY "admin_users_manage_admin_only"
  ON admin_users FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Role-based access to user notes
CREATE POLICY "user_notes_role_based"
  ON user_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND (
        au.role = 'admin' OR
        (au.role IN ('moderator', 'support') AND action = 'read')
      )
    )
  );
```

---

## API ENDPOINTS STRUCTURE

### Base Path: `/api/admin`

### Authentication Middleware
```typescript
// All admin routes require:
// 1. Valid JWT token
// 2. User exists in admin_users table
// 3. User has required permission for the action
```

### User Management Endpoints

```typescript
// GET /api/admin/users
// Query params: page, limit, search, role, status, sortBy, sortOrder
// Returns: Paginated user list with filters
GET /api/admin/users
GET /api/admin/users/:userId
GET /api/admin/users/:userId/activity
GET /api/admin/users/:userId/jobs
GET /api/admin/users/:userId/subscriptions
GET /api/admin/users/:userId/notes

// POST /api/admin/users/:userId/notes
POST /api/admin/users/:userId/notes
PUT /api/admin/users/:userId/notes/:noteId
DELETE /api/admin/users/:userId/notes/:noteId

// User actions
POST /api/admin/users/:userId/flag
POST /api/admin/users/:userId/unflag
POST /api/admin/users/:userId/suspend
POST /api/admin/users/:userId/activate
PUT /api/admin/users/:userId
DELETE /api/admin/users/:userId (soft delete)
```

### Job Monitoring Endpoints

```typescript
// GET /api/admin/jobs
// Query params: page, limit, status, type, userId, dateFrom, dateTo
GET /api/admin/jobs
GET /api/admin/jobs/:jobId
GET /api/admin/jobs/:jobId/logs
GET /api/admin/jobs/metrics
GET /api/admin/jobs/alerts

// Job actions
POST /api/admin/jobs/:jobId/cancel
POST /api/admin/jobs/:jobId/retry
POST /api/admin/jobs/:jobId/priority

// Real-time job monitoring
GET /api/admin/jobs/stream (SSE or WebSocket)
```

### System & Analytics Endpoints

```typescript
// Dashboard data
GET /api/admin/dashboard/stats
GET /api/admin/dashboard/recent-activity
GET /api/admin/dashboard/charts

// Analytics
GET /api/admin/analytics/users
GET /api/admin/analytics/jobs
GET /api/admin/analytics/revenue
GET /api/admin/analytics/usage

// System health
GET /api/admin/system/health
GET /api/admin/system/queue-status
GET /api/admin/system/api-keys-status
```

### Admin Management Endpoints

```typescript
// Admin user management (admin only)
GET /api/admin/admins
POST /api/admin/admins
PUT /api/admin/admins/:adminId
DELETE /api/admin/admins/:adminId

// Permissions
GET /api/admin/permissions
GET /api/admin/permissions/:role
PUT /api/admin/permissions/:role

// Audit logs
GET /api/admin/audit-logs
GET /api/admin/audit-logs/:logId
```

---

## FRONTEND STRUCTURE (Next.js Admin Panel)

```
admin-panel/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Main layout with sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── users/
│   │   │   ├── page.tsx         # User list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx     # User detail
│   │   │   │   ├── activity/
│   │   │   │   ├── jobs/
│   │   │   │   └── notes/
│   │   ├── jobs/
│   │   │   ├── page.tsx         # Job list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx     # Job detail
│   │   │   │   └── logs/
│   │   ├── analytics/
│   │   │   ├── page.tsx
│   │   │   ├── users/
│   │   │   ├── jobs/
│   │   │   └── revenue/
│   │   ├── system/
│   │   │   ├── page.tsx
│   │   │   ├── health/
│   │   │   └── settings/
│   │   └── admins/
│   │       ├── page.tsx
│   │       └── [id]/
│   ├── api/
│   │   └── auth/
│   └── layout.tsx
├── components/
│   ├── admin/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── UserTable.tsx
│   │   ├── JobTable.tsx
│   │   ├── StatsCard.tsx
│   │   ├── ChartCard.tsx
│   │   └── ActivityFeed.tsx
│   ├── ui/                      # shadcn/ui components
│   └── shared/
├── lib/
│   ├── api/
│   │   ├── admin.ts             # Admin API client
│   │   ├── users.ts
│   │   ├── jobs.ts
│   │   └── analytics.ts
│   ├── auth.ts                  # Auth utilities
│   ├── permissions.ts           # Permission checking
│   └── utils.ts
├── hooks/
│   ├── useAdminAuth.ts
│   ├── useUsers.ts
│   ├── useJobs.ts
│   └── usePermissions.ts
├── store/
│   ├── adminStore.ts            # Zustand store
│   └── authStore.ts
└── types/
    ├── admin.ts
    ├── user.ts
    └── job.ts
```

---

## SECURITY MODEL

### 1. Authentication Flow
```
1. Admin logs in via Supabase Auth
2. Backend validates JWT + checks admin_users table
3. Returns admin role + permissions
4. Frontend stores in secure session
5. All API calls include JWT in Authorization header
```

### 2. Authorization (Role-Based)
```typescript
// Permission checking middleware
const checkPermission = async (
  adminId: string,
  resource: string,
  action: string
): Promise<boolean> => {
  // Query admin_permissions table
  // Check if admin's role has permission
  // Cache permissions for performance
};
```

### 3. API Security
- **Rate Limiting**: Per admin user
- **IP Whitelist**: Optional for sensitive operations
- **Audit Logging**: All admin actions logged
- **CSRF Protection**: Next.js built-in
- **Input Validation**: Zod schemas for all endpoints

### 4. Data Protection
- **RLS Policies**: Database-level security
- **PII Masking**: Sensitive data masked in logs
- **Encryption**: Supabase handles at-rest encryption
- **Backup**: Regular automated backups

---

## KEY FEATURES

### User Management Dashboard
- **User List**: Searchable, filterable table
  - Filters: Role, Status, Subscription, Date Range
  - Actions: View, Edit, Flag, Suspend, Delete
- **User Detail Page**:
  - Profile information
  - Activity timeline
  - Job history
  - Subscription history
  - Notes/flags (support team)
  - Quick actions (reset password, etc.)

### Job Monitoring Dashboard
- **Job List**: Real-time status updates
  - Filters: Status, Type, User, Date
  - Actions: View, Cancel, Retry, Priority
- **Job Detail Page**:
  - Full job data
  - Progress logs
  - Error messages
  - Cost breakdown
  - Timeline
- **Metrics Dashboard**:
  - Success rate
  - Average duration
  - Cost per job type
  - Queue depth
  - Alerts

### Analytics Dashboard
- **User Analytics**:
  - Growth metrics
  - Active users
  - Retention rates
  - Subscription distribution
- **Job Analytics**:
  - Volume trends
  - Success/failure rates
  - Cost analysis
  - Peak usage times
- **Revenue Analytics**:
  - Subscription revenue
  - Conversion rates
  - Churn analysis

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
1. ✅ Database schema setup
2. ✅ Admin authentication system
3. ✅ Basic API endpoints (users, jobs)
4. ✅ RLS policies

### Phase 2: User Management (Week 3-4)
1. ✅ User list page with filters
2. ✅ User detail page
3. ✅ User actions (flag, suspend, etc.)
4. ✅ User notes system
5. ✅ Activity tracking

### Phase 3: Job Monitoring (Week 5-6)
1. ✅ Job list with real-time updates
2. ✅ Job detail page
3. ✅ Job metrics dashboard
4. ✅ Alert system
5. ✅ Job actions (cancel, retry)

### Phase 4: Analytics & Polish (Week 7-8)
1. ✅ Analytics dashboards
2. ✅ System health monitoring
3. ✅ Audit logging UI
4. ✅ Admin user management
5. ✅ Documentation

---

## NEXT STEPS

1. **Create database migrations** for admin tables
2. **Set up Next.js admin panel** project structure
3. **Implement authentication** flow
4. **Build user management** features first
5. **Add job monitoring** features
6. **Deploy and test** with real data

Would you like me to start implementing any specific part of this architecture?

