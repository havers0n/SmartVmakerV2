# Animation Pipeline Implementation Guide

## Overview

This document describes the complete implementation of the Animation Pipeline, which animates keyframe pairs using the MiniMax HALU API to create video clips.

## Architecture

```
┌─────────────────┐
│  User Interface │
│  (Next.js App)  │
└────────┬────────┘
         │
         ├─ 1. startAnimation() action
         │
┌────────▼────────┐
│  Action Handler │ ◄─── Creates animation jobs
│  generation.ts  │
└────────┬────────┘
         │
         ├─ 2. Inserts jobs into animation_job_queue
         │
┌────────▼────────────┐
│  Animation Worker   │ ◄─── Polls queue for jobs
│  animation-worker   │
└────────┬────────────┘
         │
         ├─ 3. Fetches keyframe presigned URLs from R2
         ├─ 4. Submits to HALU API
         │
┌────────▼────────┐
│   HALU API      │ ◄─── Generates video
│  (MiniMax)      │
└────────┬────────┘
         │
         ├─ 5. Sends webhook callbacks
         │
┌────────▼────────┐
│  Webhook Handler│ ◄─── Receives completion events
│  /api/webhooks/ │
│      halu       │
└────────┬────────┘
         │
         ├─ 6. Downloads video
         ├─ 7. Uploads to R2
         ├─ 8. Creates asset record
         │
┌────────▼────────┐
│   R2 Storage    │ ◄─── Stores videos
│  (Cloudflare)   │
└─────────────────┘
```

## Components

### 1. Database Schema

**Table: `animation_job_queue`** (in `jobs` schema)

```sql
CREATE TABLE jobs.animation_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES generation_pipeline.generation_projects(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL,
  asset_id_first_frame UUID NOT NULL REFERENCES generation_pipeline.assets(id) ON DELETE CASCADE,
  asset_id_last_frame UUID NOT NULL REFERENCES generation_pipeline.assets(id) ON DELETE CASCADE,
  status app_job_status DEFAULT 'pending' NOT NULL,
  halu_task_id TEXT,  -- MiniMax task_id
  retry_count INTEGER DEFAULT 0 NOT NULL,
  error TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Location:** `packages/db/migrations/schema.ts`

### 2. HALU Client Package

**Package:** `@scrimspec/halu-client`

A fully typed TypeScript client for the MiniMax HALU video generation API.

**Features:**
- Type-safe API methods
- Support for both Subject-Reference and First & Last Frame modes
- Built-in webhook challenge handling
- Polling utilities for task completion
- Direct video download support
- Comprehensive error handling with retry logic

**Key Methods:**
- `createFirstLastFrameTask(payload)` - Create animation task
- `queryTask(taskId)` - Check task status
- `retrieveFile(fileId)` - Get file metadata and download URL
- `downloadVideo(fileIdOrUrl)` - Download video as Buffer
- `pollTask(taskId, options)` - Poll until completion

**Location:** `packages/halu-client/`

**Documentation:** See `packages/halu-client/README.md`

### 3. Animation Worker

**File:** `packages/workers/src/animation-worker.ts`

**Responsibilities:**
1. Poll `animation_job_queue` for pending jobs
2. Fetch keyframe assets from database
3. Generate presigned download URLs for keyframes from R2
4. Submit First & Last Frame task to HALU API
5. Save HALU `task_id` to job record
6. Handle errors and retries

**Environment Variables Required:**
```env
# Feature flags (Action Runner)
# Эти флаги управляют доступностью действий через POST /api/actions
HWAR_ENABLE_GENERATION=1
HWAR_ENABLE_KEYFRAMES=1
HWAR_ENABLE_ANIMATION=1

MINIMAX_API_KEY=your_api_key_here
DRIZZLE_DATABASE_URL=postgresql://...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=scrimspec-assets
HALU_WEBHOOK_URL=https://your-domain.com/api/webhooks/halu
```

**Run Command:**
```bash
pnpm --filter @scrimspec/workers dev:animation
```

**Worker Loop:**
- Polls every 30 seconds when no jobs
- 2-second pause between jobs
- Uses `FOR UPDATE SKIP LOCKED` for atomic job capture
- Implements exponential backoff for rate limits

### 4. Action Handler

**File:** `apps/dashboard/src/app/api/actions/handlers/generation.ts`

**Function:** `startAnimation(payload)`

**Input Schema:**
```typescript
{
  projectId: string; // UUID
}
```

**Process:**
1. Validate project exists
2. Check that keyframes for all scenes are completed
3. Create `animation_job_queue` entries for each scene
4. Update project status to 'processing'
5. Return job creation summary

**Response:**
```typescript
{
  projectId: string;
  scenesProcessed: number;
  jobsCreated: number;
  message: string;
}
```

### 5. Webhook Handler

**File:** `apps/dashboard/src/app/api/webhooks/halu/route.ts`

**Endpoint:** `POST /api/webhooks/halu`

**Handles:**
1. **Challenge Validation** - Initial webhook setup
   ```json
   { "challenge": "string" }
   → { "challenge": "string" }
   ```

2. **Status Updates**
   - `processing` - Job in progress (no action)
   - `failed` - Update job status to failed
   - `success` - Download video, upload to R2, create asset

**Success Flow:**
1. Receive webhook with `file_id` or `video_url`
2. Download video using HALU client
3. Upload video to R2 (`animations/{projectId}/scene-{index}-{timestamp}.mp4`)
4. Create new asset record with `assetType: 'animation'`
5. Update job status to 'completed'
6. Check if all project animations are complete
7. If complete, update project status to 'completed'

### 6. UI Components

#### R2Video Component

**File:** `apps/dashboard/src/shared/components/ui/r2-video.tsx`

**Usage:**
```tsx
import { R2Video } from '@/shared/components/ui/r2-video';

<R2Video
  r2Key={asset.storageUrl}
  className="w-full h-full"
  controls
  muted
  loop
/>
```

**Features:**
- Automatic presigned URL fetching
- Loading state
- Error handling
- Customizable video controls

#### Project Detail Page Updates

**File:** `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`

**New Features:**
1. "Start Animation" button (shown when keyframes are complete)
2. Animation progress tracking
3. Video clip display for completed animations
4. Status badges (Animating, Complete)

**User Flow:**
```
1. User selects scenario
2. Clicks "Generate Keyframes"
3. Waits for keyframes to complete
4. Clicks "Start Animation"
5. Watches progress (e.g., "Animating 3/4")
6. Views completed video clips
```

### 7. API Endpoints

#### Start Animation
```typescript
// Client-side
import { startAnimation } from '@/shared/api/actions';

await startAnimation({ projectId: 'uuid' });
```

#### Get Project Assets
```http
GET /api/generation/projects/{projectId}/assets
```

Returns all assets including animations:
```json
[
  {
    "id": "uuid",
    "assetType": "animation",
    "status": "completed",
    "storageUrl": "animations/project-id/scene-0-123456.mp4",
    "meta": {
      "sceneIndex": 0,
      "haluTaskId": "106916112212032",
      "firstFrameAssetId": "uuid",
      "lastFrameAssetId": "uuid",
      "generatedAt": "2025-01-15T10:30:00Z"
    }
  }
]
```

## HALU API Integration

### Request Format

```typescript
const task = await haluClient.createFirstLastFrameTask({
  model: 'MiniMax-Hailuo-02',
  first_frame_image: 'https://presigned-r2-url/first.png',
  last_frame_image: 'https://presigned-r2-url/last.png',
  prompt: 'Smooth transition between frames. [Static shot]',
  duration: 6, // seconds
  resolution: '768P', // or '1080P'
  prompt_optimizer: false,
  callback_url: 'https://your-domain.com/api/webhooks/halu'
});

// Returns: { task_id: "106916112212032", base_resp: { ... } }
```

### Camera Commands

You can enhance prompts with camera movements:
```
'[Push in,Tilt up], then [Pull out,Pan left]'
```

Available commands:
- Truck left/right, Pan left/right
- Push in, Pull out
- Pedestal up/down, Tilt up/down
- Zoom in/out
- Shake, Tracking shot, Static shot

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1002 | Rate limit | Retry with backoff |
| 1004 | Auth error | Check API key |
| 1008 | Insufficient funds | Top up credits |
| 1026 | Sensitive content | Review prompt |
| 2013 | Invalid params | Check request |
| 2049 | Invalid API key | Update key |

### Webhook Flow

1. **Initial Setup**
   ```json
   POST /api/webhooks/halu
   { "challenge": "abc123" }
   → Response: { "challenge": "abc123" }
   ```
   Must respond within 3 seconds.

2. **Status Updates**
   ```json
   {
     "task_id": "106916112212032",
     "status": "success",
     "file_id": "file_abc123",
     "video_url": "https://cdn.example.com/video.mp4",
     "base_resp": { "status_code": 0, "status_msg": "success" }
   }
   ```

## Deployment Checklist

### Environment Variables

Add to `.env`:
```env
# MiniMax HALU API
MINIMAX_API_KEY=your_api_key_here
HALU_WEBHOOK_URL=https://your-production-domain.com/api/webhooks/halu

# R2 Storage (already configured)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=scrimspec-assets

# Database (already configured)
DRIZZLE_DATABASE_URL=postgresql://...
```

### Database Migration

Run the migration to create the `animation_job_queue` table:

```bash
# Generate migration
pnpm --filter @scrimspec/db generate:migration

# Apply migration
pnpm --filter @scrimspec/db migrate:run
```

Or use Supabase migration tools if you're using Supabase.

### Install Dependencies

```bash
# Install halu-client in workers
pnpm install

# Build packages
pnpm --filter @scrimspec/halu-client build
pnpm --filter @scrimspec/workers build
```

### Start Workers

In production, use a process manager like PM2:

```bash
# Development
pnpm --filter @scrimspec/workers dev:animation

# Production
pm2 start "pnpm --filter @scrimspec/workers start:animation" --name "animation-worker"
```

### Configure Webhook

1. Deploy the Next.js app with the webhook endpoint
2. Ensure `/api/webhooks/halu` is accessible from the internet
3. Test webhook with challenge:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/halu \
     -H "Content-Type: application/json" \
     -d '{"challenge":"test123"}'

   # Should return: {"challenge":"test123"}
   ```

### Verify Setup

1. **Database:** Check `animation_job_queue` table exists
2. **Worker:** Verify worker starts without errors
3. **API Key:** Test HALU client connection
4. **R2:** Ensure presigned URLs work
5. **Webhook:** Test challenge response

## Testing

### Manual Test Flow

1. **Create a project** with scenarios
2. **Generate keyframes** for a scenario
3. Wait for keyframes to complete (check R2 storage)
4. **Start animation** via UI or API
5. Check `animation_job_queue` for pending jobs
6. **Monitor worker logs** for job processing
7. Check HALU webhook receives callbacks
8. Verify video uploaded to R2
9. View video in UI

### Verify Each Component

#### Test HALU Client
```typescript
import { createHaluClient } from '@scrimspec/halu-client';

const client = createHaluClient({
  apiKey: process.env.MINIMAX_API_KEY!
});

// Test task creation
const task = await client.createFirstLastFrameTask({
  model: 'MiniMax-Hailuo-02',
  first_frame_image: 'https://test-url.com/first.jpg',
  last_frame_image: 'https://test-url.com/last.jpg',
  duration: 6,
  resolution: '768P',
});

console.log('Task ID:', task.task_id);
```

#### Test Webhook
```bash
# Challenge
curl -X POST http://localhost:3000/api/webhooks/halu \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test"}'

# Status update
curl -X POST http://localhost:3000/api/webhooks/halu \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-task",
    "status": "processing"
  }'
```

#### Test Worker
```bash
# Start worker in development
pnpm --filter @scrimspec/workers dev:animation

# Check logs for:
# - "Starting animation worker"
# - "HALU API key configured"
# - "No pending jobs, waiting 30 seconds"
```

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Callbacks

**Symptoms:** Jobs stuck in 'processing', no webhook logs

**Solutions:**
- Ensure webhook URL is publicly accessible
- Check firewall/security group settings
- Verify HTTPS certificate (HALU requires HTTPS)
- Test challenge response manually
- Check HALU API dashboard for webhook status

#### 2. Worker Can't Fetch Keyframes

**Symptoms:** Worker errors about missing assets

**Solutions:**
- Verify keyframe generation completed
- Check R2 presigned URL generation
- Ensure R2 credentials are correct
- Verify asset records exist in database

#### 3. Rate Limits

**Symptoms:** HTTP 1002 errors from HALU

**Solutions:**
- Implement backoff in worker (already done)
- Reduce concurrency
- Check API quota/limits
- Contact MiniMax support for limit increase

#### 4. Videos Not Uploading to R2

**Symptoms:** Webhook receives video but R2 upload fails

**Solutions:**
- Check R2 credentials
- Verify bucket permissions
- Check storage quota
- Review upload logs for errors

#### 5. Project Status Not Updating

**Symptoms:** All animations complete but project status stuck

**Solutions:**
- Check webhook logic for project status update
- Verify all jobs in `animation_job_queue` are 'completed'
- Manually update project if needed:
  ```sql
  UPDATE generation_pipeline.generation_projects
  SET status = 'completed'
  WHERE id = 'project-uuid';
  ```

## Performance Optimization

### Concurrent Processing

The animation worker processes one job at a time by default. To increase throughput:

1. **Run multiple worker instances**
   ```bash
   pm2 start animation-worker.js -i 3  # 3 instances
   ```

2. **Adjust polling intervals**
   - Decrease from 30s to 10s for faster job pickup
   - Balance against database load

3. **Batch operations**
   - Fetch multiple jobs per cycle (modify worker)
   - Process in parallel (be careful with rate limits)

### Caching

- Presigned URLs are cached by the client (15-minute TTL)
- Consider caching project/asset lookups in worker

### Monitoring

Add metrics for:
- Jobs processed per minute
- Average completion time
- Error rates
- HALU API latency
- R2 upload times

## Cost Estimation

### HALU API Costs

MiniMax-Hailuo-02 pricing (check current rates):
- 768P, 6s: ~$0.05-0.10 per video
- 768P, 10s: ~$0.08-0.15 per video
- 1080P, 6s: ~$0.10-0.20 per video

Example project (4 scenes, 6s each):
- Cost: 4 × $0.10 = ~$0.40 per project

### R2 Storage Costs

- Storage: $0.015 per GB/month
- Operations: Minimal (few writes/reads)
- Bandwidth: Free egress to Cloudflare

Typical video sizes:
- 6s @ 768P: ~2-5 MB
- 6s @ 1080P: ~5-10 MB

## Future Enhancements

### Planned Features

1. **Custom Prompts per Scene**
   - Allow users to specify camera movements
   - Per-scene prompt templates

2. **Quality Settings**
   - Resolution selection (768P/1080P)
   - Duration options (6s/10s)

3. **Retry Mechanism**
   - Automatic retry on failure
   - Manual retry from UI

4. **Progress Notifications**
   - Email/push notifications
   - Real-time websocket updates

5. **Batch Processing**
   - Queue multiple projects
   - Priority queue

6. **Analytics**
   - Success/failure rates
   - Average processing time
   - Cost tracking

### API Enhancements

1. **Status Endpoint**
   ```http
   GET /api/generation/projects/{projectId}/animation-status
   ```

2. **Cancel Animation**
   ```http
   POST /api/generation/projects/{projectId}/cancel-animation
   ```

3. **Retry Failed Jobs**
   ```http
   POST /api/generation/animation-jobs/{jobId}/retry
   ```

## Support

For issues or questions:
1. Check this documentation
2. Review logs (worker, webhook, API)
3. Test individual components
4. Consult HALU API docs: `docs/hailouapi/api.md`
5. Check MiniMax documentation

## References

- [HALU API Documentation](../docs/hailouapi/api.md)
- [HALU Client Package](../packages/halu-client/README.md)
- [MiniMax Official Docs](https://platform.minimax.io/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
