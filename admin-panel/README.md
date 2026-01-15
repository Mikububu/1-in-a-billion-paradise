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
│   │   ├── subscriptions/
│   │   ├── llm-config/
│   │   ├── services/
│   │   ├── storage/
│   │   └── analytics/
│   └── api/
├── components/
│   ├── admin/
│   │   ├── AdminDashboard.tsx      # Main dashboard with tabs
│   │   ├── APIServicesPanel.tsx    # API balances & status (RunPod, Claude, etc.)
│   │   ├── QueueStatusPanel.tsx    # Job queue monitoring
│   │   ├── LLMConfigPanel.tsx      # LLM providers per system
│   │   ├── SubscriptionsPanel.tsx  # Subscription & reading tracking
│   │   ├── SystemConfigPanel.tsx   # System configuration viewer
│   │   └── StorageUsagePanel.tsx   # Supabase storage usage
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

### LLM Configuration
- `GET /api/admin/llm/config` - Get LLM provider config

### Subscriptions
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/subscriptions/:id` - Get subscription
- `GET /api/admin/subscriptions/stats` - Get stats
- `POST /api/admin/subscriptions/:id/reset-reading` - Reset reading

### API Services Status (NEW)
- `GET /api/admin/services/status` - Get all API service statuses and balances
- `GET /api/admin/services/runpod/detailed` - Detailed RunPod endpoint and job info

### System Configuration (NEW)
- `GET /api/admin/system/config` - Get all system configuration values

### Queue Status (NEW)
- `GET /api/admin/queue/status` - Get job queue status by status and task type

### Storage Usage
- `GET /api/admin/storage/usage` - Get Supabase storage bucket usage

### Cost Tracking (NEW)
- `GET /api/admin/costs/today` - Today's costs breakdown
- `GET /api/admin/costs/month` - This month's costs breakdown
- `GET /api/admin/costs/range` - Custom date range costs
- `GET /api/admin/costs/logs` - Recent cost log entries
- `GET /api/admin/costs/pricing` - Current pricing configuration
- `GET /api/admin/costs/by-job/:id` - Detailed costs for a specific job

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

---

## API Services Monitored

The admin panel monitors these external services:

| Service | Purpose | Balance API |
|---------|---------|-------------|
| **RunPod** | TTS Audio (Chatterbox) | ✅ GraphQL API |
| **Anthropic (Claude)** | Deep Readings (LLM) | ❌ Check dashboard |
| **OpenAI** | Kabbalah Readings | ❌ Check dashboard |
| **DeepSeek** | Hook Readings | ❌ Check dashboard |
| **MiniMax** | Song Generation | ❌ Check dashboard |
| **Google Places** | City Search | ❌ Check dashboard |
| **Stripe** | Payments | Check dashboard |
| **Supabase Storage** | Audio, PDFs, Songs | ✅ Via API |

### RunPod Balance Check
The admin panel can fetch your RunPod credit balance via their GraphQL API:
```graphql
query { myself { creditBalance currentSpendPerHr } }
```

---

## Admin Panel Components

### AdminDashboard.tsx
Main dashboard with tabbed navigation:
- Overview (recent changes, quick stats)
- **Costs (NEW)** - Token usage, costs by provider, job costs
- API Services (balances, status)
- Job Queue (live monitoring)
- LLM Config (per-system providers)
- Subscriptions ($9.90/year management)
- Storage (bucket usage)
- System Config (feature flags, settings)

### CostTrackingPanel.tsx (NEW)
Track costs for all API calls:
- Today's costs vs. This month
- Breakdown by provider (Claude, DeepSeek, OpenAI, RunPod)
- Recent cost log entries with token counts
- Top jobs by cost
- Pricing reference table

---

## API Pricing (Jan 2026)

| Provider | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|----------------------|------------------------|
| **DeepSeek** | $0.14 | $0.28 |
| **Claude Sonnet 4** | $3.00 | $15.00 |
| **OpenAI GPT-4o** | $2.50 | $10.00 |
| **RunPod** | ~$0.0004/sec | ~$0.024/min |

### APIServicesPanel.tsx
Shows status and balances for all external services:
- RunPod credit balance and spend rate
- Endpoint worker status
- Service connection status

### QueueStatusPanel.tsx
Live job queue monitoring:
- Tasks by status (pending, processing, complete, error)
- Tasks by type (text, audio, pdf)
- Stuck task detection
- Error rate calculation

### SystemConfigPanel.tsx
View system configuration:
- LLM provider assignments
- Tragic Realism level
- Queue settings
- Worker configuration
- Feature flags