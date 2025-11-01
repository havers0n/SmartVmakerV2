# Retry Mechanism for External API Calls

## Overview

This document describes the implementation of automatic retry logic for all external API calls in the Scrimspec workers. The retry mechanism uses exponential backoff to handle transient failures from YouTube API and Gemini API.

## Implementation Date

2025-11-01

## Problem Statement

Workers make frequent calls to external APIs:
- **YouTube Data API v3** (ingest-worker, enrichment-worker)
- **Gemini AI API** (analysis-worker)

These APIs can experience:
- Temporary network failures (ECONNRESET, ETIMEDOUT)
- Server errors (5xx status codes)
- Rate limiting (429 status code)
- Request timeouts (408 status code)

Without retry logic, any transient error causes the entire job to fail immediately, reducing system reliability.

## Solution

Implemented a centralized retry mechanism using the `p-retry` library with the following features:

### 1. Retry Utility (`packages/workers/src/utils/retry.ts`)

Created a reusable wrapper function `retryFetch()` that:
- Wraps any async operation (typically fetch calls)
- Implements exponential backoff strategy
- Logs each retry attempt with structured data
- Differentiates between retryable and non-retryable errors
- Provides configurable retry parameters

### 2. Configuration

**Default Settings**:
- **Retries**: 3 attempts (initial + 3 retries = 4 total attempts)
- **Strategy**: Exponential backoff
- **Min Delay**: 1000ms (1 second)
- **Max Delay**: 10000ms (10 seconds)
- **Backoff Factor**: 2

**Delay Progression**:
1. First retry: 1000ms
2. Second retry: 2000ms
3. Third retry: 4000ms

### 3. Retryable Errors

The mechanism automatically retries on:
- **5xx Server Errors**: 500, 502, 503, 504, etc.
- **429 Rate Limit**: Too many requests
- **408 Timeout**: Request timeout
- **Network Errors**: ECONNRESET, ETIMEDOUT, ENOTFOUND, ENETUNREACH

**Non-retryable Errors** (abort immediately):
- **4xx Client Errors**: 400, 401, 403, 404 (except 408, 429)
- **Custom abort conditions**: Can be configured per-use case

## Integration Points

### 1. Ingest Worker (YouTube Search API)

**File**: `packages/workers/src/ingest-worker.ts:161`

```typescript
const data: YouTubeSearchResponse = await retryFetch(
  async () => {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.json();
  },
  logger,
  { retries: 3 }
);
```

### 2. Enrichment Worker (YouTube Videos API)

**File**: `packages/workers/src/enrichment-worker.ts:161`

```typescript
const data: YouTubeVideosResponse = await retryFetch(
  async () => {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `YouTube API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    return response.json();
  },
  logger,
  { retries: 3 }
);
```

### 3. Analysis Worker (Gemini AI API)

**File**: `packages/workers/src/analysis-worker.ts:93` (model validation)
**File**: `packages/workers/src/analysis-worker.ts:301` (video analysis)

```typescript
const geminiResponse: GeminiResponse = await retryFetch(
  async () => {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    return response.json();
  },
  logger,
  { retries: 3 }
);
```

## Logging Behavior

The retry mechanism integrates with `@aec/logger` to provide detailed logging:

### On Retry Attempt (Warning Level)

```
[10:49:23.850] WARN (ingest-worker): API call failed, retrying...
    attempt: 1
    retriesLeft: 3
    nextRetryDelay: "1000ms"
    error: "HTTP 503: Service Temporarily Unavailable"
```

### On Final Failure (Error Level)

```
[10:49:30.123] ERROR (ingest-worker): All retry attempts exhausted
    attempt: 4
    error: "HTTP 503: Service Temporarily Unavailable"
```

### On Non-Retryable Error (Warning Level)

```
[10:49:25.456] WARN (ingest-worker): Non-retryable error encountered, aborting retry
    error: "HTTP 401: Unauthorized"
```

## Testing

A test script demonstrates the retry mechanism:

**File**: `packages/workers/src/test-retry.ts`

**Run the test**:
```bash
npx tsx packages/workers/src/test-retry.ts
```

**Expected Output**:
```
[10:49:23.848] INFO (retry-test): Starting retry mechanism test
[10:49:23.849] INFO (retry-test): Simulated API called
    attemptCount: 1
[10:49:23.850] WARN (retry-test): API call failed, retrying...
    attempt: 1
    retriesLeft: 3
    nextRetryDelay: "1000ms"
[10:49:24.851] INFO (retry-test): Simulated API called
    attemptCount: 2
[10:49:24.851] WARN (retry-test): API call failed, retrying...
    attempt: 2
    retriesLeft: 2
    nextRetryDelay: "2000ms"
[10:49:26.867] INFO (retry-test): Simulated API called
    attemptCount: 3
[10:49:26.868] INFO (retry-test): Test completed successfully
```

## Benefits

### 1. Improved Reliability
- Automatically recovers from transient failures
- Reduces false-negative job failures
- Increases overall system uptime

### 2. Cost Efficiency
- Avoids unnecessary job re-queuing
- Reduces manual intervention
- Optimizes API quota usage

### 3. Observability
- Detailed logs for each retry attempt
- Clear visibility into API stability
- Easy debugging of persistent failures

### 4. Smart Error Handling
- Distinguishes between temporary and permanent failures
- Avoids wasting retries on client errors (4xx)
- Configurable retry logic per use case

## Error Flow

```
┌─────────────────┐
│  API Call       │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Failed?│──No──▶ Success
    └───┬────┘
        │ Yes
        ▼
  ┌──────────────┐
  │ Retryable?   │──No──▶ Abort (throw error)
  └──────┬───────┘
         │ Yes
         ▼
  ┌──────────────┐
  │ Retries left?│──No──▶ Final failure (throw error)
  └──────┬───────┘
         │ Yes
         ▼
  ┌──────────────┐
  │ Wait (backoff)│
  └──────┬───────┘
         │
         ▼
     (retry)
```

## Configuration Examples

### Custom Retry Count

```typescript
const data = await retryFetch(
  async () => { /* operation */ },
  logger,
  { retries: 5 }  // 5 retries instead of 3
);
```

### Custom Backoff

```typescript
const data = await retryFetch(
  async () => { /* operation */ },
  logger,
  {
    retries: 3,
    minTimeout: 500,   // Start with 500ms
    maxTimeout: 5000,  // Cap at 5 seconds
    factor: 3          // Triple delay each time
  }
);
```

### Custom Retry Logic

```typescript
const data = await retryFetch(
  async () => { /* operation */ },
  logger,
  {
    retries: 3,
    shouldRetry: (error) => {
      // Custom logic: only retry on specific errors
      return error.message.includes('RATE_LIMIT');
    }
  }
);
```

## Dependencies

### Added to `packages/workers/package.json`:

```json
{
  "dependencies": {
    "p-retry": "^6.2.1"
  }
}
```

## Metrics to Monitor

When deploying to production, consider monitoring:

1. **Retry Rate**: Percentage of API calls that require retries
2. **Success After Retry**: How often retries succeed
3. **Retry Attempts Distribution**: Which attempt typically succeeds
4. **Final Failure Rate**: Percentage of calls that exhaust all retries
5. **API-Specific Patterns**: Which API (YouTube vs Gemini) requires more retries

## Future Enhancements

Potential improvements for the retry mechanism:

1. **Circuit Breaker**: Stop retrying if API is consistently down
2. **Jitter**: Add randomness to backoff delays to avoid thundering herd
3. **Per-API Configuration**: Different retry settings for YouTube vs Gemini
4. **Metrics Collection**: Track retry statistics for monitoring
5. **Adaptive Backoff**: Adjust delays based on API response headers

## References

- [p-retry Documentation](https://github.com/sindresorhus/p-retry)
- [Exponential Backoff Best Practices](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Retry Utility Source](../packages/workers/src/utils/retry.ts)

## Conclusion

The retry mechanism is fully implemented and tested across all workers. All external API calls now benefit from:
- Automatic retry with exponential backoff
- Intelligent error classification
- Detailed retry logging
- Configurable retry behavior

This significantly improves system reliability and resilience to transient API failures.
