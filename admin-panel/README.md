# 1 in a Billion - Admin Panel

## Overview

React admin panel for managing the 1-in-a-Billion platform. Built with Next.js 14 and Tailwind CSS.

## Setup

### 1. Create the Next.js App

```bash
cd admin-panel
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

### 2. Install Dependencies

```bash
npm install zustand @tanstack/react-query
npm install @supabase/supabase-js
```

### 3. Configure Environment

Create `.env.local`:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=https://one-in-a-billion.fly.dev

# For local development:
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Add Components

Copy the `components/admin/` and `lib/api/` directories into your Next.js app.

### 5. Create Main Page

Create `app/page.tsx`:

```tsx
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default function Home() {
  return <AdminDashboard />;
}
```

---

## Architecture

### API Client (`lib/api/client.ts`)

Centralized API client that:
- Handles authentication via Bearer token (stored in localStorage)
- Points to the backend at `NEXT_PUBLIC_API_URL`
- Provides typed API methods for all endpoints

### Components

| Component | Description |
|-----------|-------------|
| `AdminDashboard.tsx` | Main dashboard with tabbed navigation |
| `CostTrackingPanel.tsx` | 💰 Token usage, costs by provider, job costs |
| `APIServicesPanel.tsx` | 🔌 API service status and balances |
| `QueueStatusPanel.tsx` | 📋 Real-time job queue monitoring |
| `LLMConfigPanel.tsx` | 🤖 LLM provider configuration per system |
| `SubscriptionsPanel.tsx` | 💳 Subscription and included reading management |
| `StorageUsagePanel.tsx` | 💾 Supabase storage bucket usage |
| `SystemConfigPanel.tsx` | ⚙️ System configuration and feature flags |

---

## Backend API Endpoints

All endpoints require admin authentication via `Authorization: Bearer <token>` header.

### Dashboard
- `GET /api/admin/dashboard/stats` - Overview statistics

### Users
- `GET /api/admin/users` - List users with pagination
- `GET /api/admin/users/:userId` - Get user details
- `PUT /api/admin/users/:userId` - Update user
- `POST /api/admin/users/:userId/notes` - Add note to user

### Jobs
- `GET /api/admin/jobs` - List jobs with filters
- `GET /api/admin/jobs/:jobId` - Get job details
- `GET /api/admin/jobs/metrics` - Job metrics
- `POST /api/admin/jobs/:jobId/cancel` - Cancel a job

### Subscriptions
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/subscriptions/:subscriptionId` - Get subscription details
- `GET /api/admin/subscriptions/stats` - Subscription statistics
- `POST /api/admin/subscriptions/:subscriptionId/reset-reading` - Reset included reading

### LLM Configuration
- `GET /api/admin/llm/config` - Get LLM provider configuration

### Services
- `GET /api/admin/services/status` - All API service status/balances
- `GET /api/admin/services/runpod/detailed` - Detailed RunPod info

### Queue
- `GET /api/admin/queue/status` - Job queue status

### System
- `GET /api/admin/system/config` - System configuration

### Storage
- `GET /api/admin/storage/usage` - Supabase storage usage

### Cost Tracking
- `GET /api/admin/costs/today` - Today's costs breakdown
- `GET /api/admin/costs/month` - This month's costs breakdown
- `GET /api/admin/costs/range?start=&end=` - Custom date range costs
- `GET /api/admin/costs/logs` - Recent cost log entries
- `GET /api/admin/costs/pricing` - Current pricing configuration
- `GET /api/admin/costs/by-job/:jobId` - Detailed costs for a specific job

---

## API Pricing (Jan 2026)

| Provider | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|----------------------|------------------------|
| **DeepSeek** | $0.14 | $0.28 |
| **Claude Sonnet 4** | $3.00 | $15.00 |
| **OpenAI GPT-4o** | $2.50 | $10.00 |
| **RunPod** | ~$0.0004/sec | ~$0.024/min |

---

## Deployment

### Fly.io

```bash
fly launch --name admin-billion-control
fly deploy
```

### Vercel

```bash
vercel
```

---

## Authentication

The admin panel uses JWT-based authentication:

1. Admin logs in via `/api/auth/admin/login` (not yet implemented in panel)
2. Token is stored in `localStorage` as `admin_token`
3. All API requests include `Authorization: Bearer <token>` header

**Temporary Setup**: For initial access, you can manually set the token:

```javascript
// In browser console
localStorage.setItem('admin_token', 'YOUR_ADMIN_TOKEN');
location.reload();
```

---

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## File Structure

```
admin-panel/
├── components/
│   └── admin/
│       ├── AdminDashboard.tsx      # Main dashboard with tabs
│       ├── APIServicesPanel.tsx    # API balances & status
│       ├── CostTrackingPanel.tsx   # Cost tracking & logs
│       ├── QueueStatusPanel.tsx    # Job queue monitoring
│       ├── LLMConfigPanel.tsx      # LLM provider config
│       ├── SubscriptionsPanel.tsx  # Subscription management
│       ├── SystemConfigPanel.tsx   # System config viewer
│       └── StorageUsagePanel.tsx   # Storage usage
├── lib/
│   └── api/
│       └── client.ts               # Centralized API client
└── README.md
```
