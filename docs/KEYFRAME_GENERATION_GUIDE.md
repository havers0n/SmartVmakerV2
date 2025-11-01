# Keyframe Generation Feature - Complete Guide

## Overview

The Keyframe Generation feature allows you to generate AI-powered keyframes (first and last frames) for each scene in your video project using Google's Gemini 2.5 Flash Image model.

## Architecture

### Components

1. **Action Handler** (`apps/dashboard/src/app/api/actions/handlers/generation.ts`)
   - `generateKeyframes()` - Creates keyframe generation jobs for selected scenario

2. **Worker** (`packages/workers/src/keyframe-worker.ts`)
   - Processes jobs from `keyframe_job_queue`
   - Calls Gemini Image Generation API
   - Uploads generated images to Supabase Storage

3. **Database Schema** (`packages/db/migrations/schema.ts`)
   - `keyframe_job_queue` - Queue for keyframe generation tasks
   - `assets` - Stores generated keyframe metadata and URLs

4. **UI** (`apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`)
   - Project detail page with scenario selection
   - Keyframe generation trigger
   - Real-time progress display

### Data Flow

```
User selects scenario
       ↓
generateKeyframes action
       ↓
Creates assets + jobs in DB
       ↓
keyframe-worker picks up jobs
       ↓
Calls Gemini Image API
       ↓
Uploads to Supabase Storage
       ↓
Updates asset with URL
       ↓
UI displays generated images
```

## Setup Instructions

### 1. Environment Variables

Ensure these variables are set in your `.env` file:

```bash
# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (for storage)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DRIZZLE_DATABASE_URL=your_database_url
DATABASE_URL=your_database_url
```

### 2. Database Setup

The `keyframe_job_queue` table is already defined in the schema. Ensure migrations are applied:

```bash
pnpm --filter @scrimspec/db push
```

### 3. Storage Bucket Setup

Create the required Supabase Storage bucket:

```bash
pnpm --filter @scrimspec/db storage:setup
```

This will create a public `keyframes` bucket with:
- Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`
- File size limit: 10MB

### 4. Start the Worker

In a separate terminal, start the keyframe worker:

```bash
pnpm --filter @scrimspec/workers dev:keyframe
```

The worker will:
- Poll the `keyframe_job_queue` every 30 seconds when idle
- Process jobs with retry logic (3 retries)
- Upload generated images to Supabase Storage
- Update asset records with storage URLs

## Testing Guide

### Step 1: Create a Project

1. Navigate to `/hwar/create/new`
2. Fill in the project details:
   - Title: "Test Keyframe Generation"
   - Ratio: "9:16" (or "16:9")
   - Source: "Prompt" (or use a preset)
   - Prompt: "A story about a cute puppy learning to skateboard"
3. Click "Generate Scenarios"

**Expected Result:** Project is created with 3 scenario options

### Step 2: Select a Scenario

1. The system redirects you to `/hwar/create/[project_id]`
2. Review the generated scenarios (they should show AES scores, hook strength, emotional curves)
3. Click on one scenario card to select it
4. Click the "Generate Keyframes" button

**Expected Result:**
- Toast notification: "Created X keyframe generation jobs for Y scenes"
- Project status changes to "processing"
- Progress badge appears showing "Generating 0/X"

### Step 3: Monitor Generation Progress

The page automatically refreshes every 3-5 seconds while generation is in progress.

**Expected Behavior:**
- Progress badge updates: "Generating 1/8", "Generating 2/8", etc.
- Scene cards appear with loading spinners for pending frames
- As images complete, they replace the loading spinners
- When all complete, badge changes to "Complete" with green checkmark

### Step 4: Verify Generated Keyframes

For each scene, you should see:
- **Opening Frame:** Shows the initial state of the scene
- **Closing Frame:** Shows the final state/result of the scene
- Images should match the aspect ratio you selected (9:16 or 16:9)
- Images should be photorealistic and match the scene descriptions

### Troubleshooting

#### Worker Not Processing Jobs

**Check:**
```bash
# Verify worker is running
# Look for: "Starting keyframe worker"

# Check database for pending jobs
# Query: SELECT * FROM jobs.keyframe_job_queue WHERE status = 'pending'
```

**Common Issues:**
- GEMINI_API_KEY not set → Check .env file
- Worker not running → Start with `pnpm --filter @scrimspec/workers dev:keyframe`
- Database connection issues → Check DRIZZLE_DATABASE_URL

#### Images Not Appearing in UI

**Check:**
1. Asset status in database:
   ```sql
   SELECT id, status, storage_url, meta
   FROM generation_pipeline.assets
   WHERE generation_project_id = 'your_project_id'
   ```

2. Supabase Storage bucket:
   - Go to Supabase Dashboard → Storage → keyframes
   - Verify images are uploaded
   - Check if bucket is public

3. Browser console for fetch errors

#### Failed Jobs

**Check job errors:**
```sql
SELECT id, status, error_message, prompt
FROM jobs.keyframe_job_queue
WHERE status = 'failed'
```

**Common Errors:**
- Gemini API quota exceeded → Check your Google Cloud billing
- Invalid prompt → Gemini rejected the content
- Storage upload failed → Check Supabase credentials

## API Reference

### Action: `generation.generateKeyframes`

**Endpoint:** `POST /api/actions`

**Request:**
```json
{
  "action": "generation.generateKeyframes",
  "payload": {
    "projectId": "uuid",
    "selectedScenarioIndex": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "projectId": "uuid",
    "scenesProcessed": 4,
    "jobsCreated": 8,
    "message": "Created 8 keyframe generation jobs for 4 scenes"
  }
}
```

### Client Function

```typescript
import { generateKeyframes } from '@/shared/api/actions';

const result = await generateKeyframes({
  projectId: 'your-project-id',
  selectedScenarioIndex: 0
});
```

## Database Schema

### `keyframe_job_queue`

Located in `jobs` schema:

```typescript
{
  id: uuid (PK)
  projectId: uuid (FK → generation_projects)
  sceneIndex: integer
  frameType: 'first' | 'last'
  prompt: text
  assetId: uuid (FK → assets)
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: integer
  error: text
  errorMessage: text
  createdAt: timestamp
  updatedAt: timestamp
}
```

### `assets` (keyframe records)

Located in `generation_pipeline` schema:

```typescript
{
  id: uuid (PK)
  generationProjectId: uuid (FK)
  assetType: 'keyframe'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  storageUrl: text
  meta: {
    sceneIndex: number
    frameType: 'first' | 'last'
    phase: 'HOOK' | 'BUILD' | 'PAYOFF' | 'RESOLUTION'
    duration: number
    aspectRatio: '9:16' | '16:9'
  }
}
```

## Performance Notes

- **Image Generation Time:** ~5-10 seconds per image with Gemini 2.5 Flash Image
- **Typical Project:** 4 scenes = 8 images = ~1-2 minutes total
- **Concurrent Processing:** Worker processes one job at a time (sequential)
- **Retry Logic:** 3 retries with exponential backoff (handled by `retryFetch`)

## Cost Estimation

Gemini 2.5 Flash Image pricing (as of 2025):
- **Cost per image:** ~$0.01 (varies by region)
- **Typical project (4 scenes):** ~$0.08
- **100 projects:** ~$8.00

## Next Steps

After keyframe generation, the next stages in the pipeline would be:

1. **Video-to-Video Generation** - Use keyframes as input/reference for Minimax/Luma
2. **Scene Assembly** - Stitch generated video clips together
3. **Audio/Music** - Add voiceover and background music
4. **Final Composition** - Export final video

## Related Files

- Action Handler: `apps/dashboard/src/app/api/actions/handlers/generation.ts:276`
- Worker: `packages/workers/src/keyframe-worker.ts`
- UI Page: `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`
- Schema: `packages/db/migrations/schema.ts:399`
- Client API: `apps/dashboard/src/shared/api/actions.ts:132`
- Storage Setup: `packages/db/scripts/setup-storage-buckets.ts`
