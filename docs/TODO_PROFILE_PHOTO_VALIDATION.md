# Profile Photo Validation - Future Implementation

## Overview
Profile photo uploads must be validated using external libraries to ensure:
1. Photos contain a real person (not objects)
2. No nudity or inappropriate content
3. No famous/celebrity photos
4. No AI-generated images (future)

## Requirements

### 1. Person Detection
- Reject images without a detectable human face
- Reject images of objects, landscapes, pets, etc.
- Show clear message: "Please upload a photo of yourself, not an object"

### 2. Nudity/NSFW Detection
- Reject images with nudity or inappropriate content
- Show clear message: "Nudity is not allowed in profile photos"

### 3. Celebrity/Famous Person Detection
- Detect and reject photos of celebrities, public figures, or famous people
- Show clear message: "Celebrity or public figure photos are not permitted"
- **Research needed**: Compare available APIs for accuracy and coverage

## Recommended External Services

### Option A: AWS Rekognition
- **Face Detection**: `DetectFaces` API
- **Content Moderation**: `DetectModerationLabels` API (nudity, suggestive, violence)
- **Celebrity Recognition**: `RecognizeCelebrities` API
- **Pros**: All-in-one solution, well-documented, pay-per-use
- **Cons**: AWS account required, potentially complex IAM setup
- **Pricing**: ~$1 per 1,000 images (varies by API)

### Option B: Azure Cognitive Services
- **Face API**: Face detection and verification
- **Content Moderator**: Adult/racy content detection
- **Celebrity Recognition**: Via Computer Vision API
- **Pros**: Good accuracy, Microsoft ecosystem integration
- **Cons**: Multiple APIs needed, separate pricing
- **Pricing**: ~$1 per 1,000 transactions

### Option C: Google Cloud Vision
- **Face Detection**: Built-in
- **Safe Search Detection**: Adult, violence, racy content
- **Celebrity Detection**: Via Web Detection (limited)
- **Pros**: Easy to use, good documentation
- **Cons**: Celebrity detection less reliable
- **Pricing**: ~$1.50 per 1,000 images

### Option D: Clarifai
- **Face Detection**: Built-in models
- **NSFW Detection**: Pre-built model
- **Celebrity Recognition**: Pre-built model
- **Pros**: Single API for all needs, specialized models
- **Cons**: Less mainstream, pricing can scale
- **Pricing**: Free tier available, then usage-based

### Option E: Sightengine
- **Face Detection**: Yes
- **Nudity Detection**: Very accurate
- **Celebrity Detection**: Limited
- **Pros**: Specialized for moderation, real-time API
- **Cons**: No celebrity recognition
- **Pricing**: Free tier (500/month), then usage-based

## Recommended Approach

### Phase 1: Basic Validation
1. Integrate **Clarifai** or **AWS Rekognition** for:
   - Face detection (is there a person?)
   - NSFW/nudity detection
2. Estimated implementation: 2-3 days

### Phase 2: Celebrity Detection
1. Use **AWS Rekognition** `RecognizeCelebrities` API
2. If confidence > 80%, reject with message
3. Estimated implementation: 1-2 days

### Phase 3: Enhanced Validation (Future)
1. AI-generated image detection (deepfakes)
2. Age verification (minors)
3. Multiple face detection (is this the user's photo?)

## Implementation Architecture

```
Frontend (React Native)
    │
    ▼
Backend Endpoint: POST /api/profile/validate-photo
    │
    ├── 1. Receive base64 image
    │
    ├── 2. Call validation service (Clarifai/AWS/etc.)
    │
    ├── 3. Check results:
    │   ├── No face detected? → Reject "Please upload a photo of yourself"
    │   ├── NSFW detected? → Reject "Nudity is not allowed"
    │   ├── Celebrity detected? → Reject "Celebrity photos not permitted"
    │   └── All checks pass? → Allow upload
    │
    └── 4. Return validation result
```

## API Response Format

```typescript
interface PhotoValidationResponse {
  valid: boolean;
  error?: {
    code: 'NO_FACE' | 'NSFW' | 'CELEBRITY' | 'INVALID_FORMAT' | 'UNKNOWN';
    message: string;
  };
  confidence?: number;
  detectedCelebrity?: string; // For logging/debugging
}
```

## Cost Estimates

For 1,000 profile photo validations per month:
- **AWS Rekognition**: ~$3-5/month (face + moderation + celebrity)
- **Clarifai**: ~$0-5/month (free tier covers most)
- **Azure**: ~$3-5/month

## Research Tasks

- [ ] Evaluate AWS Rekognition celebrity recognition accuracy
- [ ] Test Clarifai vs AWS for NSFW detection accuracy
- [ ] Benchmark API response times (target: <500ms)
- [ ] Investigate AI-generated image detection options
- [ ] Consider caching/hashing to avoid re-validating same image

## Priority

**Medium-High** - Important for platform integrity but not blocking launch.

## Last Updated
January 25, 2026
