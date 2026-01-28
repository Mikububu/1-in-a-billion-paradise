# RunPod Runner Strategy – Current and Future State

## Current Decision
We are **not using an always-on GPU** at this stage.  
We are using **on-demand RunPod workers** that may be cold when a job starts.

This means:
- Runners can take **several minutes to warm up**
- Audio and long-running generation jobs can be **significantly delayed**
- This is **expected behavior**, not a bug

This decision is intentional to:
- Avoid fixed monthly GPU costs during early-stage development
- Pay only when jobs are actually executed
- Accept slower first-job latency in exchange for lower burn

---

## Implications for Backend Code (Required Behavior)

Because runners are not always-on, the backend **must be written to expect delays**.

### The backend MUST:
- Treat job execution as **eventually consistent**
- Never assume immediate availability of audio or PDFs
- Never hard-timeout just because a job is slow
- Poll job/task status instead of expecting instant results
- Distinguish clearly between:
  - `queued`
  - `processing`
  - `completed`
  - `failed`

### The backend MUST NOT:
- Assume RunPod responds immediately
- Fail a job just because audio is not ready yet
- Tie UI behavior to synchronous job completion

---

## Job Lifecycle (Authoritative)

1. User requests a reading
2. Backend creates a job and tasks in Supabase
3. Tasks may sit idle while RunPod warms up
4. Worker eventually starts and processes tasks
5. Artifacts (audio, PDF, text) are generated
6. Backend updates task and job status
7. Frontend observes status changes and updates UI

**Long delays are acceptable and expected in this phase.**

---

## Frontend Expectations

The frontend MUST:
- Show "processing" or "preparing" states
- Allow waiting without errors
- Resume correctly if the app is backgrounded or restarted
- Never assume audio will be ready immediately

---

## Timeout Strategy

- There should be **no hard short timeout** for generation
- Timeouts should be **soft**, informative, and recoverable
- The system should prefer "still working" over "failed"

---

## Future Upgrade: Always-On GPU

Later, when usage justifies it:
- We will switch to an **always-on RunPod GPU**
- Warm-up delays disappear
- Job latency becomes predictable and fast
- Monthly fixed cost is accepted as a business expense

**When this happens:**
- The architecture stays the same
- Only worker configuration changes
- No rewrite of frontend or backend logic is required

---

## Key Principle

We design the system **asynchronously first**,  
so infrastructure decisions (cold vs warm GPUs)  
do **not leak into business logic or UX**.

This document is the authority for how RunPod runners are handled.
