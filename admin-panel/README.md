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
│   │   └── analytics/
│   └── api/
├── components/
│   ├── admin/
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

