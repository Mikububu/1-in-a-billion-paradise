````markdown
# TODOs → Issue Summary

This file extracts high-value TODO/checklist items from docs and proposes Issue titles, short descriptions, suggested owners, and priority.

1) Apply migration 017 to database
- Title: "Apply migration 017 — verify voice selection fixes"
- Description: Run `migrations/017_...sql` in staging then production; verify voice selection for jobs and confirm audio tasks use correct voices. Include verification queries and rollback steps.
- Suggested owner: backend-eng
- Priority: High

2) Add Song display to reading screens
- Title: "Add song generation UI to FullReadingScreen / DeepReadingReaderScreen"
- Description: Integrate generated song artifacts into `FullReadingScreen` and `DeepReadingReaderScreen`. Add player UI, streaming via signed URL, and tests for playback.
- Suggested owner: frontend-eng
- Priority: Medium

3) Persistent GPU workers + RunPod processing fix
- Title: "Fix RunPod worker workflow and enable persistent GPU workers"
- Description: Investigate current RunPod integration (reported as broken), ensure workers claim tasks reliably, and document persistent deployment strategy for GPU workers.
- Suggested owner: infra-eng / ops
- Priority: High

4) Convert doc checklists into tracked tickets
- Title: "Convert documentation checklists to GitHub issues"
- Description: Transform key doc checklist items (migration steps, deploy steps, critical rules) into actionable GitHub issues with owners and due dates.
- Suggested owner: engineering-manager
- Priority: Medium

5) Add WebSocket / real-time updates
- Title: "Add WebSocket or real-time mechanism for job progress"
- Description: Implement optional WebSocket or Supabase Realtime to push job/task updates to clients for faster UX.
- Suggested owner: backend-eng
- Priority: Low

6) Audit and rotate any leaked keys
- Title: "Audit repo for secrets and rotate exposed keys"
- Description: Ensure no real keys exist in repo or history; rotate any that were exposed and add a short doc for key rotation procedure.
- Suggested owner: security
- Priority: High

7) Standardize env var names & update docs
- Title: "Standardize environment variable names in docs"
- Description: Keep `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for API clients and `DATABASE_URL` for Postgres `psql` commands. Update docs and scripts to mention both and mapping.
- Suggested owner: docs
- Priority: Medium

---

If you want, I can create a GitHub issue export (JSON) for these items or open them in your issue tracker—tell me which option you prefer.

````
