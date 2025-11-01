# Worker Utilities

Shared utilities for Scrimspec workers.

## Retry Utility

### Overview

The `retry.ts` module provides automatic retry logic for external API calls with exponential backoff.

### Usage

```typescript
import { retryFetch } from './utils/retry';
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'my-worker' });

// Basic usage
const data = await retryFetch(
  async () => {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  },
  logger,
  { retries: 3 }
);
```

### Features

- **Exponential Backoff**: Delays increase exponentially between retries
- **Smart Error Detection**: Automatically identifies retryable errors
- **Structured Logging**: Logs each retry attempt with context
- **Configurable**: Customize retry count, delays, and retry conditions

### Configuration Options

```typescript
interface RetryOptions {
  retries?: number;        // Default: 3
  factor?: number;         // Default: 2 (exponential multiplier)
  minTimeout?: number;     // Default: 1000ms
  maxTimeout?: number;     // Default: 10000ms
  shouldRetry?: (error: Error) => boolean;  // Custom retry logic
}
```

### Default Behavior

**Retryable Errors**:
- 5xx Server Errors (500, 502, 503, 504, etc.)
- 429 Rate Limit
- 408 Request Timeout
- Network errors (ECONNRESET, ETIMEDOUT, etc.)

**Non-Retryable Errors**:
- 4xx Client Errors (except 408, 429)
- Custom abort conditions

### Examples

#### Custom Retry Count

```typescript
const data = await retryFetch(
  async () => fetch(url).then(r => r.json()),
  logger,
  { retries: 5 }
);
```

#### Custom Backoff Settings

```typescript
const data = await retryFetch(
  async () => fetch(url).then(r => r.json()),
  logger,
  {
    retries: 3,
    minTimeout: 500,   // Start at 500ms
    maxTimeout: 5000,  // Cap at 5s
    factor: 3          // Triple delay each time
  }
);
```

#### Custom Retry Logic

```typescript
const data = await retryFetch(
  async () => fetch(url).then(r => r.json()),
  logger,
  {
    retries: 3,
    shouldRetry: (error) => {
      // Only retry on specific conditions
      return error.message.includes('RATE_LIMIT') ||
             error.message.includes('503');
    }
  }
);
```

### Delay Calculation

With default settings (factor=2, minTimeout=1000ms):

| Attempt | Delay      |
|---------|------------|
| 1       | 1000ms     |
| 2       | 2000ms     |
| 3       | 4000ms     |

Formula: `delay = min(minTimeout * factor^(attempt-1), maxTimeout)`

### Testing

Run the test script to see retry in action:

```bash
npx tsx packages/workers/src/test-retry.ts
```

### Integration Examples

See these files for real-world usage:
- `ingest-worker.ts:161` - YouTube Search API
- `enrichment-worker.ts:161` - YouTube Videos API
- `analysis-worker.ts:93,301` - Gemini AI API

### API Reference

#### `retryFetch<T>(operation, logger, options): Promise<T>`

Wraps an async operation with retry logic.

**Parameters**:
- `operation: () => Promise<T>` - The async function to retry
- `logger: Logger` - Logger instance for retry logging
- `options?: RetryOptions` - Configuration options

**Returns**: `Promise<T>` - The result of the operation

**Throws**: The last error if all retries are exhausted

#### `calculateBackoffDelay(attempt, options): number`

Calculates delay for a given retry attempt.

**Parameters**:
- `attempt: number` - Current attempt number (1-indexed)
- `options?: RetryOptions` - Retry configuration

**Returns**: `number` - Delay in milliseconds

### Error Handling

```typescript
try {
  const data = await retryFetch(
    async () => fetch(url).then(r => r.json()),
    logger,
    { retries: 3 }
  );
  // Success
} catch (error) {
  // All retries exhausted
  logger.error({ err: error }, 'Failed after all retries');
}
```

### Best Practices

1. **Always log retries**: Pass a logger to track retry behavior
2. **Set appropriate timeouts**: Balance between recovery and user experience
3. **Don't retry forever**: Use reasonable retry counts (3-5)
4. **Use custom logic**: Implement `shouldRetry` for special cases
5. **Monitor metrics**: Track retry rates in production

### Dependencies

- `p-retry` - Core retry implementation
- `@aec/logger` - Structured logging

### Related Documentation

- [Full Retry Mechanism Documentation](../../../../docs/RETRY_MECHANISM.md)
- [Logger Package](../../../logger/README.md)
