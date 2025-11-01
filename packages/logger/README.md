# @aec/logger

Centralized structured logging package for the Scrimspec monorepo, built on top of [pino](https://github.com/pinojs/pino).

## Features

- **Fast & Efficient**: Built on pino, one of the fastest Node.js loggers
- **Structured Logging**: JSON-based logs with rich metadata
- **Environment-Aware**:
  - Development: Pretty-printed colored logs with timestamps
  - Production: JSON format ready for log aggregation systems
- **Type-Safe**: Full TypeScript support with exported types
- **Easy Integration**: Simple API for creating named loggers

## Installation

This package is part of the workspace and is used internally:

```json
{
  "dependencies": {
    "@aec/logger": "workspace:*"
  }
}
```

## Usage

### Basic Usage

```typescript
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'my-service' });

logger.info('Service started');
logger.warn({ userId: 123 }, 'User action detected');
logger.error({ err: error }, 'Operation failed');
```

### With Structured Data

```typescript
logger.info(
  {
    userId: 123,
    action: 'video-upload',
    duration: 1500
  },
  'Video uploaded successfully'
);
```

### Error Logging

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error({ err: error }, 'Failed to process request');
}
```

### Log Levels

Available log levels (in order of severity):
- `fatal` - Application is about to crash
- `error` - Error occurred but application continues
- `warn` - Warning message
- `info` - Informational message (default in production)
- `debug` - Debug information (default in development)
- `trace` - Very detailed debugging

```typescript
logger.debug({ query: 'SELECT *' }, 'Executing database query');
logger.fatal({ err: error }, 'Unrecoverable error, shutting down');
```

## Configuration

### Creating a Logger

```typescript
import { createLogger, type Logger } from '@aec/logger';

const logger: Logger = createLogger({
  name: 'worker-name',           // Required: Service/component name
  level: 'debug',                // Optional: Minimum log level
  context: {                     // Optional: Additional context for all logs
    workerId: process.pid,
    version: '1.0.0'
  }
});
```

### Environment Variables

The logger automatically adapts based on `NODE_ENV`:
- `development`: Uses pino-pretty for human-readable output
- `production`: Uses JSON format for machine parsing

## Output Examples

### Development Mode (pino-pretty)

```
[10:20:10.018] INFO (enrichment-worker): Worker environment initialized
    nodeEnv: "development"
[10:20:14.232] DEBUG (enrichment-worker): No videos to enrich, waiting
```

### Production Mode (JSON)

```json
{"level":30,"time":1699012810018,"pid":12345,"hostname":"worker-1","name":"enrichment-worker","nodeEnv":"production","msg":"Worker environment initialized"}
{"level":20,"time":1699012814232,"pid":12345,"hostname":"worker-1","name":"enrichment-worker","msg":"No videos to enrich, waiting"}
```

## Best Practices

### 1. Create Named Loggers

Always create loggers with descriptive names:

```typescript
// ✅ Good
const logger = createLogger({ name: 'ingest-worker' });
const logger = createLogger({ name: 'api-analysis' });

// ❌ Avoid
const logger = createLogger({ name: 'worker' });
```

### 2. Use Structured Data

Include relevant context as the first argument:

```typescript
// ✅ Good
logger.info({ jobId: 123, videoCount: 50 }, 'Processing batch');

// ❌ Avoid
logger.info(`Processing batch with jobId: 123 and videoCount: 50`);
```

### 3. Log Errors Properly

Use the `err` field for error objects:

```typescript
// ✅ Good
logger.error({ err: error, jobId: 123 }, 'Job failed');

// ❌ Avoid
logger.error(`Job ${jobId} failed: ${error.message}`);
```

### 4. Choose Appropriate Log Levels

```typescript
logger.debug({ query }, 'Executing query');        // Development debugging
logger.info({ count: 10 }, 'Processed items');     // Normal operations
logger.warn({ retries: 3 }, 'Retry threshold');    // Warnings
logger.error({ err }, 'Operation failed');         // Errors
logger.fatal({ err }, 'Critical failure');         // Fatal errors
```

## Integration Examples

### Worker Integration

```typescript
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'analysis-worker' });

async function main() {
  logger.info('Starting worker');
  logger.info({ apiKey: !!process.env.API_KEY }, 'Configuration');

  while (true) {
    try {
      const job = await fetchJob();
      logger.info({ jobId: job.id }, 'Processing job');
      // ... process job
      logger.info({ jobId: job.id }, 'Job completed');
    } catch (error) {
      logger.error({ err: error }, 'Job processing failed');
    }
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Worker crashed');
  process.exit(1);
});
```

### API Route Integration

```typescript
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'api-ingest' });

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    logger.info({ query: payload.query }, 'Creating ingest job');

    const job = await createJob(payload);
    logger.info({ jobId: job.id }, 'Job created successfully');

    return Response.json({ success: true, jobId: job.id });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create job');
    return Response.json({ success: false }, { status: 500 });
  }
}
```

## Dependencies

- `pino` - Fast JSON logger
- `pino-pretty` - Pretty-print formatter for development

## License

Private package for internal use only.
