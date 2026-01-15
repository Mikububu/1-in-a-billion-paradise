# ADMIN PANEL - Next.js Implementation

## Setup Instructions

```bash
cd admin-panel
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Then install dependencies:
```bash
npm install zustand @tanstack/react-query @tanstack/react-table recharts
npm install @supabase/supabase-js
npm install -D @types/node
```

## Project Structure

```
admin-panel/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── users/
│   │   ├── jobs/
│   │   ├── subscriptions/    # NEW: Subscription management
│   │   ├── llm-config/       # NEW: LLM provider configuration
│   │   └── analytics/
│   └── api/
├── components/
│   ├── admin/
│   │   ├── LLMConfigPanel.tsx      # NEW: View/manage LLM providers per system
│   │   ├── SubscriptionsPanel.tsx  # NEW: Subscription & reading tracking
│   │   └── ...
│   └── ui/
├── lib/
│   ├── api/
│   └── auth.ts
└── types/
```

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## New Features (Jan 2026)

### 1. LLM Provider Configuration Panel

View and manage which LLM provider is used for each reading system:

| System | Provider Options |
|--------|-----------------|
| Western | Claude Sonnet 4 / DeepSeek / OpenAI |
| Vedic | Claude Sonnet 4 / DeepSeek / OpenAI |
| Human Design | Claude Sonnet 4 / DeepSeek / OpenAI |
| Gene Keys | Claude Sonnet 4 / DeepSeek / OpenAI |
| Kabbalah | Claude Sonnet 4 / DeepSeek / OpenAI |
| Verdict | Claude Sonnet 4 / DeepSeek / OpenAI |

**Current Config:**
- Claude Sonnet 4: Western, Vedic, Human Design, Gene Keys, Verdict
- OpenAI: Kabbalah (Hebrew/mystical accuracy)

**API Endpoints:**
- `GET /api/admin/llm/config` - Get current configuration

**Component:** `components/admin/LLMConfigPanel.tsx`

### 2. Subscription Management Panel

Track $9.90/year subscriptions and included reading usage:

**Features:**
- View all subscriptions with filters (status, reading used/available)
- Stats: Active subs, readings used, readings available, usage rate
- Breakdown by system (which systems are most popular)
- Reset included reading for a user (admin action)

**API Endpoints:**
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/subscriptions/:id` - Get subscription details
- `GET /api/admin/subscriptions/stats` - Get statistics
- `POST /api/admin/subscriptions/:id/reset-reading` - Reset included reading

**Component:** `components/admin/SubscriptionsPanel.tsx`

---

## Backend Admin Routes

All admin routes require authentication and appropriate permissions.

### User Management
- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `POST /api/admin/users/:id/notes` - Add note

### Job Monitoring
- `GET /api/admin/jobs` - List jobs
- `GET /api/admin/jobs/:id` - Get job details
- `POST /api/admin/jobs/:id/cancel` - Cancel job
- `GET /api/admin/jobs/metrics` - Get metrics

### Dashboard
- `GET /api/admin/dashboard/stats` - Dashboard statistics

### LLM Configuration (NEW)
- `GET /api/admin/llm/config` - Get LLM provider config

### Subscriptions (NEW)
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/subscriptions/:id` - Get subscription
- `GET /api/admin/subscriptions/stats` - Get stats
- `POST /api/admin/subscriptions/:id/reset-reading` - Reset reading

---

## Database Tables

### user_subscriptions
```sql
id UUID PRIMARY KEY
user_id UUID
email TEXT
stripe_customer_id TEXT
stripe_subscription_id TEXT
status TEXT -- 'active', 'cancelled', etc.
included_reading_used BOOLEAN DEFAULT false
included_reading_system TEXT -- 'western', 'vedic', etc.
included_reading_job_id UUID
current_period_start TIMESTAMPTZ
current_period_end TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### LLM Config (Code-based)
Currently configured in `backend/src/config/llmProviders.ts`:
```typescript
export const SYSTEM_LLM_PROVIDERS = {
  western: 'claude',
  vedic: 'claude',
  human_design: 'claude',
  gene_keys: 'claude',
  kabbalah: 'openai',
  verdict: 'claude',
};
```

Future: Runtime config via JSON file or database.