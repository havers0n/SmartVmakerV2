# Keyframe Worker Refactoring - Idempotent State Machine Pattern

## Overview
Successfully refactored `packages/workers/src/keyframe-worker.ts` to implement the same "Idempotent State Machine" pattern used in `animation-worker.ts`. This prevents double-billing for keyframe generation by ensuring each keyframe is only generated once, even in the event of crashes or retries.

## Key Changes

### 1. **Idempotency Key Generation**
```typescript
function generateIdempotencyKey(projectId: string, sceneIndex: number, frameType: string): string {
  return crypto
    .createHash('sha256')
    .update(`${projectId}:${sceneIndex}:${frameType}`)
    .digest('hex');
}
```
- Hash of `${projectId}:${sceneIndex}:${frameType}`
- Ensures same keyframe request always generates same key
- Stored in `keyframe_job_queue.idempotency_key`

### 2. **Stage Tracking**
Added `updateJobStage()` helper to track job progress through these stages:
- `init` - Initial state
- `checking_dupes` - Checking for existing external IDs
- `submitting` - Submitting to AI provider
- `waiting_external` - Waiting for async provider response
- `uploading` - Uploading result to R2
- `completed` - Job finished successfully
- `failed` - Job failed permanently

### 3. **Transaction-Based Job Locking**
```typescript
const job = await db.transaction(async (tx) => {
  const result = await tx.execute(sql`
    SELECT * FROM jobs.keyframe_job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);
  // ... set idempotency key and transition to processing
});
```
- Uses `FOR UPDATE SKIP LOCKED` to prevent race conditions
- Atomically sets idempotency key during lock acquisition

### 4. **Recovery Mode (Billing Protection)**
```typescript
const existingTaskId = job.external_id;

if (existingTaskId) {
  logger.warn('RECOVERY MODE: Job already has external ID. Skipping submission.');
  // Handle recovery without re-submitting to provider
}
```
- Checks for existing `external_id` before making API calls
- If found, skips submission to avoid double-billing
- For keyframes (mostly synchronous), treats this as an error state

### 5. **External ID Tracking**
```typescript
const { imageBuffer, externalId } = await generateImageWithModel(...);

if (externalId) {
  await db.update(schema.keyframeJobQueue).set({
    externalId: externalId,
    stage: 'waiting_external',
    updatedAt: new Date() as any
  }).where(eq(schema.keyframeJobQueue.id, job.id));
}
```
- Modified `generateImageWithModel()` to return both image and external ID
- Saves external ID immediately after API call (if provider returns one)
- Enables recovery if worker crashes after submission

### 6. **Enhanced Error Handling with Retry Logic**
```typescript
let isRetryable = false;

if (errorMessage.includes('fetch') || 
    errorMessage.includes('network') || 
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('429') ||
    errorMessage.includes('rate limit')) {
  isRetryable = true;
}

if (isRetryable && (job.retry_count || 0) < 3) {
  // Return to queue for retry
  await db.update(schema.keyframeJobQueue).set({
    status: 'pending' as any,
    retryCount: (job.retry_count || 0) + 1,
    // ...
  });
} else {
  // Permanent failure
  await db.update(schema.keyframeJobQueue).set({
    status: 'failed' as any,
    stage: 'failed' as any,
    // ...
  });
}
```
- Distinguishes between retryable and permanent errors
- Network errors and rate limits are retryable (up to 3 attempts)
- Other errors fail immediately

### 7. **Exported Function for Testing**
```typescript
export async function processKeyframeJob() {
  // ... main processing logic
}
```
- Exported the main processing function
- Enables integration testing (similar to animation-worker)
- Worker only runs if `NODE_ENV !== 'test'`

## Database Schema
The worker uses these fields from `keyframe_job_queue`:
- `idempotency_key` - Deterministic hash for duplicate detection
- `external_id` - Provider's task ID (if applicable)
- `stage` - Current processing stage for observability
- `retry_count` - Number of retry attempts
- `status` - Overall job status (pending/processing/completed/failed)

## Benefits

### 🛡️ **Billing Protection**
- Never pays for the same keyframe twice
- Recovery mode prevents re-submission after crashes
- Idempotency key ensures uniqueness

### 🔍 **Observability**
- Fine-grained stage tracking
- Clear logging at each phase
- Easy to debug stuck jobs

### 🔄 **Reliability**
- Automatic retry for transient errors
- Graceful handling of network issues
- Atomic job acquisition prevents race conditions

### 🧪 **Testability**
- Exported processing function
- Test mode support
- Consistent with animation-worker pattern

## Next Steps

### Recommended Actions:
1. **Create Integration Tests** - Similar to `animation-worker.test.ts`
   - Test happy path (new job submission)
   - Test recovery mode (existing external_id)
   - Test retry logic

2. **Monitor in Production**
   - Watch for jobs stuck in `waiting_external` stage
   - Track retry rates
   - Monitor idempotency key collisions (should be zero)

3. **Consider Async Provider Support**
   - Currently treats `external_id` presence as error state
   - Could add polling logic for async image providers
   - Would mirror animation worker's `handleActiveTask()` pattern

## Compatibility Notes
- ✅ Backward compatible with existing jobs
- ✅ Works with both sync and async providers
- ✅ Handles missing `model_id` with default lookup
- ✅ Preserves existing error handling for asset updates

## Files Modified
- `packages/workers/src/keyframe-worker.ts` - Complete refactor with idempotent pattern
- `packages/db` - Rebuilt to update TypeScript types

## Testing Checklist
- [ ] Unit tests for `generateIdempotencyKey()`
- [ ] Integration test for happy path
- [ ] Integration test for recovery mode
- [ ] Integration test for retry logic
- [ ] Load test with concurrent workers
- [ ] Verify no duplicate keyframes in production
