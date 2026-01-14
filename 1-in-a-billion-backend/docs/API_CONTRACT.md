# API Contract - Supabase Job Queue

## Base URL

```
Production: https://api.oneinabillion.app
Development: http://localhost:8787
```

## Authentication

All endpoints require `Authorization: Bearer {token}` header (Supabase JWT).

### POST /api/auth/signup

Creates a new Supabase Auth user.

- **Normalizes email**: trims and lowercases before attempting signup
- **Duplicate signup protection**: if the email is already registered, returns **HTTP 409**

**Request:**
```typescript
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name"?: "Optional display name"
}
```

**Response (account already exists):** `409 Conflict`
```typescript
{
  "success": false,
  "error": "Account already exists",
  "code": "ACCOUNT_EXISTS"
}
```

## Endpoints

### POST /api/jobs/start

Create a new job and enqueue tasks.

**Request:**
```typescript
{
  "type": "nuclear_v2" | "synastry" | "extended",
  "params": {
    "person1": {
      "name": "Michael",
      "birthDate": "1990-01-15",
      "birthTime": "14:30",
      "birthPlace": "Bangkok",
      "latitude": 13.7563,
      "longitude": 100.5018,
      "timezone": "Asia/Bangkok"
    },
    "person2": {  // Optional, for synastry
      ...
    },
    "systems": ["vedic", "western", "human_design", "gene_keys", "kabbalah"],
    "relationshipIntensity": 7,  // 1-10
    "relationshipMode": "sensual"  // sensual | romantic | brutal
  }
}
```

**Response:** `201 Created`
```typescript
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedMinutes": 5-10,
  "pollUrl": "/api/jobs/550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET /api/jobs/:id

Get job status and progress (single source of truth).

**Response:** `200 OK`
```typescript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "nuclear_v2",
  "status": "processing" | "complete" | "error" | "queued",
  "progress": {
    "percent": 45,
    "phase": "text" | "pdf" | "audio" | "finalizing" | "complete",
    "message": "Generating chapter: Hunger...",
    "docsComplete": 7,
    "docsTotal": 16,
    "currentDoc": "Hunger - Vedic Analysis"
  },
  "createdAt": "2025-12-19T16:30:00Z",
  "updatedAt": "2025-12-19T16:35:00Z",
  "completedAt": null,
  "artifacts": [
    {
      "id": "artifact-uuid",
      "type": "audio_mp3",
      "url": "https://supabase.co/storage/.../chapter1.mp3",  // Signed URL (1hr)
      "duration": 180,
      "fileSize": 2457600,
      "createdAt": "2025-12-19T16:32:00Z"
    },
    {
      "id": "artifact-uuid-2",
      "type": "pdf",
      "url": "https://supabase.co/storage/.../chapter1.pdf",
      "fileSize": 524288,
      "createdAt": "2025-12-19T16:33:00Z"
    }
  ],
  "error": null
}
```

**When Complete:**
```typescript
{
  "id": "...",
  "status": "complete",
  "progress": {
    "percent": 100,
    "phase": "complete",
    "message": "Generation complete!"
  },
  "artifacts": [
    // 16 audio files (MP3)
    {
      "type": "audio_mp3",
      "url": "https://.../portraits_vedic.mp3",
      "duration": 300,
      "chapter": "Portraits - Vedic"
    },
    // 16 PDF files
    {
      "type": "pdf",
      "url": "https://.../portraits_vedic.pdf",
      "pageCount": 8,
      "chapter": "Portraits - Vedic"
    },
    // 1 combined PDF
    {
      "type": "pdf",
      "url": "https://.../full_nuclear.pdf",
      "pageCount": 128,
      "isCombined": true
    }
  ],
  "metadata": {
    "totalAudioMinutes": 60,
    "totalPages": 128,
    "totalWords": 32000
  }
}
```

---

### GET /api/jobs/:id/artifacts

List all artifacts for a job (audio, PDF, JSON).

**Response:** `200 OK`
```typescript
{
  "artifacts": [
    {
      "id": "...",
      "type": "audio_mp3",
      "url": "https://...",  // Signed URL (1hr expiry)
      "fallbackUrl": "https://.../m4a",  // M4A fallback if MP3 fails
      "duration": 180,
      "fileSize": 2457600,
      "metadata": {
        "chapter": "Portraits",
        "system": "vedic",
        "codec": "mp3",
        "bitrate": 128
      }
    }
  ]
}
```

---

### GET /api/jobs/:id/audio/:artifactId

Stream audio with fallback support.

**Flow:**
1. Try MP3 primary URL
2. If 404/error → try M4A fallback
3. If both fail → return error

**Response:** `200 OK` (audio stream)
```
Content-Type: audio/mpeg
Content-Length: 2457600
Cache-Control: public, max-age=3600

[Binary MP3 data]
```

**Fallback:** `audio/mp4` (M4A)

**Never:** `audio/wav` (too large, not streamed)

---

### DELETE /api/jobs/:id

Cancel a job (soft delete).

**Response:** `200 OK`
```typescript
{
  "success": true,
  "message": "Job cancelled"
}
```

## Polling Strategy

### Client-Side Implementation

```typescript
async function pollJobStatus(jobId: string): Promise<Job> {
  let attempt = 0;
  const maxAttempts = 120; // 10 minutes max (120 × 5s)
  
  while (attempt < maxAttempts) {
    const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
    
    if (job.status === 'complete') {
      return job;
    }
    
    if (job.status === 'error') {
      throw new Error(job.error);
    }
    
    // Exponential backoff (5s → 10s → 15s → 30s max)
    const delay = Math.min(5000 + (attempt * 1000), 30000);
    await sleep(delay);
    attempt++;
  }
  
  throw new Error('Job timeout');
}
```

### Progress Events (Optional - WebSocket)

For real-time updates without polling:

```typescript
const ws = new WebSocket(`wss://api.oneinabillion.app/jobs/${jobId}/stream`);

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`Progress: ${progress.percent}% - ${progress.message}`);
};
```

## Audio Serving Strategy

### Priority Order

1. **MP3 (Primary)**
   - 128kbps, good quality/size balance
   - Universal browser support
   - Streamable

2. **M4A (Fallback)**
   - Better quality at same bitrate
   - iOS/Safari preferred
   - Streamable

3. **WAV (Never)**
   - ❌ Too large (10x bigger than MP3)
   - ❌ Not suitable for streaming
   - ❌ Wastes Storage quota

### Client Audio Player

```typescript
<audio controls>
  <source src="{mp3Url}" type="audio/mpeg" />
  <source src="{m4aUrl}" type="audio/mp4" />
  Your browser does not support audio playback.
</audio>
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid parameters",
  "details": {
    "birthDate": "Invalid date format"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 404 Not Found
```json
{
  "error": "Job not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "requestId": "req-abc-123"
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /jobs/start | 5 | 1 minute |
| GET /jobs/:id | 60 | 1 minute |
| GET /jobs/:id/artifacts | 30 | 1 minute |

## Webhooks (Future)

```json
POST {webhookUrl}
{
  "event": "job.completed",
  "jobId": "...",
  "status": "complete",
  "artifacts": [...]
}
```

## SDK Example

```typescript
import { SupabaseJobClient } from '@1iab/job-client';

const client = new SupabaseJobClient({
  apiUrl: 'https://api.oneinabillion.app',
  apiKey: 'your-api-key'
});

// Start job
const job = await client.jobs.create({
  type: 'nuclear_v2',
  params: {...}
});

// Poll for completion
const result = await client.jobs.waitFor(job.id);

// Stream audio
const audioUrl = result.artifacts.find(a => a.type === 'audio_mp3')?.url;
```


