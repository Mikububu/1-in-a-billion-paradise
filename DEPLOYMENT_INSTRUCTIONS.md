# DEPLOYMENT INSTRUCTIONS

**READ THIS BEFORE DEPLOYING ANYTHING**

## Fly.io Deploy (Backend)

**CRITICAL: Always run from the backend folder, NOT the parent folder.**

```bash
cd 1-in-a-billion-backend
fly deploy
```

**Why:**
- Running from parent folder uploads 245 MB (frontend, docs, migrations, etc.)
- Running from backend folder uploads 2 MB (backend source only)
- Deploy time: 2.5 minutes (correct) vs 10+ minutes (wrong)

**What happens during deploy:**
- Fly builds a complete new Docker image (always full rebuild, no incremental updates)
- Uploads ~272 MB final image to Fly registry
- Replaces all 7 running machines with new image
- This is normal and cannot be optimized further

## EAS Update (Frontend)

```bash
cd 1-in-a-billion-frontend
bash ./scripts/publish-eas-update.sh
```

**What happens:**
- Bundles JS/assets (~4 MB)
- Publishes OTA update to `main` branch
- Users get update on next app launch

## Git Push

```bash
git add .
git commit -m "Your message"
git push origin main
```

**Always commit before deploying** so Fly/EAS use the latest code.

## Common Mistakes (DO NOT DO THIS)

❌ `cd "1 in a Billion" && fly deploy` (uploads 245 MB, takes 10+ minutes)
❌ Running `fly deploy` without setting `FLY_API_TOKEN` (auth error)
❌ Forgetting to `git push` before deploying (deploys old code)

## Depot (Remote Builder)

- Fly uses Depot automatically for Docker builds
- You don't need to sign up or configure anything
- It's just Fly's default remote builder service
- No separate billing or account needed

## Deploy Checklist

1. ✅ Make code changes
2. ✅ Test locally (optional)
3. ✅ `git add . && git commit -m "..." && git push origin main`
4. ✅ `cd 1-in-a-billion-backend && fly deploy` (backend)
5. ✅ `cd 1-in-a-billion-frontend && bash ./scripts/publish-eas-update.sh` (frontend)

---

**Last updated:** 2026-01-24
**If AI suggests anything different, show it this file first.**
