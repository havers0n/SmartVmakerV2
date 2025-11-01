# Structured Logging Implementation

## Overview

This document describes the implementation of centralized structured logging across the Scrimspec monorepo using the `@aec/logger` package built on top of pino.

## Implementation Date

2025-11-01

## What Was Done

### 1. Created `@aec/logger` Package

**Location**: `packages/logger/`

**Key Files**:
- `src/index.ts` - Main logger implementation
- `package.json` - Package configuration with pino dependencies
- `tsconfig.json` - TypeScript configuration
- `README.md` - Comprehensive documentation

**Features**:
- Environment-aware logging (pretty-print for development, JSON for production)
- Structured logging with rich metadata support
- TypeScript support with exported types
- Simple API: `createLogger({ name: 'service-name' })`

### 2. Replaced `console.log` in Workers

**Files Modified**:
- `packages/workers/src/ingest-worker.ts`
- `packages/workers/src/enrichment-worker.ts`
- `packages/workers/src/analysis-worker.ts`

**Changes**:
- Added `@aec/logger` dependency to `packages/workers/package.json`
- Created named loggers for each worker
- Replaced all `console.log`, `console.warn`, `console.error` with structured logging
- Added contextual data to log entries (jobId, videoId, counts, etc.)

**Example Before**:
```typescript
console.log(`[Ingest Worker] Processing job ${job.id}: query="${job.query}"`);
console.error(`[Ingest Worker] Job ${job.id} failed:`, errorMessage);
```

**Example After**:
```typescript
logger.info({ jobId: job.id, query: job.query }, 'Processing job');
logger.error({ err: error, jobId: job.id }, 'Job failed');
```

### 3. Integrated Logger into API Routes

**Files Modified**:
- `apps/dashboard/src/app/api/actions/handlers/ingest.ts`
- `apps/dashboard/src/app/api/actions/handlers/analysis.ts`

**Changes**:
- Added `@aec/logger` dependency to `apps/dashboard/package.json`
- Created named loggers for API handlers (`api-ingest`, `api-analysis`)
- Added logging for job creation and errors
- Replaced `console.error` with structured error logging

## Benefits

### 1. Structured Data
- All logs now include structured JSON data
- Easy to query and analyze in log aggregation systems
- Consistent format across all services

### 2. Performance
- Pino is one of the fastest Node.js loggers
- Minimal overhead even in high-throughput scenarios

### 3. Development Experience
- Pretty-printed colored output in development
- Clear timestamps and service names
- Easy to read and debug

### 4. Production Ready
- JSON format ready for ELK, Datadog, CloudWatch, etc.
- Automatic error serialization
- Configurable log levels

### 5. Maintainability
- Centralized logging configuration
- Easy to update logging behavior across all services
- Type-safe logging API

## Log Output Examples

### Development Mode

```
[10:20:10.018] INFO (enrichment-worker): Worker environment initialized
    nodeEnv: "development"
[10:20:14.232] DEBUG (enrichment-worker): No videos to enrich, waiting
[10:20:15.123] INFO (enrichment-worker): Found videos to enrich
    videoCount: 25
```

### Production Mode

```json
{"level":30,"time":1699012810018,"pid":12345,"hostname":"worker-1","name":"enrichment-worker","nodeEnv":"production","msg":"Worker environment initialized"}
{"level":20,"time":1699012814232,"pid":12345,"hostname":"worker-1","name":"enrichment-worker","msg":"No videos to enrich, waiting"}
{"level":30,"time":1699012815123,"pid":12345,"hostname":"worker-1","name":"enrichment-worker","videoCount":25,"msg":"Found videos to enrich"}
```

## Usage Guidelines

### Creating a Logger

```typescript
import { createLogger } from '@aec/logger';

const logger = createLogger({
  name: 'service-name',  // Required
  level: 'debug',        // Optional (defaults to 'info' in prod, 'debug' in dev)
  context: {             // Optional additional context
    version: '1.0.0'
  }
});
```

### Logging with Context

```typescript
// ✅ Good - Structured data
logger.info({ userId: 123, action: 'upload' }, 'User action');

// ❌ Avoid - String interpolation
logger.info(`User ${userId} performed ${action}`);
```

### Error Logging

```typescript
try {
  await operation();
} catch (error) {
  // ✅ Use 'err' field for proper error serialization
  logger.error({ err: error, jobId: 123 }, 'Operation failed');
}
```

## Migration Status

### ✅ Completed
- [x] Created `@aec/logger` package
- [x] Integrated into all 3 workers (ingest, enrichment, analysis)
- [x] Integrated into API handlers (ingest, analysis)
- [x] Type checking passes
- [x] Tested with enrichment worker
- [x] Documentation created

### 🚧 Future Improvements (Optional)
- [ ] Add request ID tracking for API routes
- [ ] Add log sampling for high-frequency debug logs
- [ ] Integrate with log aggregation service (CloudWatch, Datadog, etc.)
- [ ] Add log rotation for file-based logging if needed
- [ ] Create dashboard for log analysis

## Configuration

### Environment Variables

The logger automatically detects the environment:
- `NODE_ENV=development` → Pretty-printed colored logs
- `NODE_ENV=production` → JSON format

### Log Levels

Available levels (in order of severity):
1. `fatal` - Application is about to crash
2. `error` - Error occurred
3. `warn` - Warning
4. `info` - Informational (default in production)
5. `debug` - Debug information (default in development)
6. `trace` - Very detailed debugging

## Testing

To test the logger in action:

```bash
# Run any worker in development mode
pnpm --filter @scrimspec/workers dev:enrich

# You should see colored, pretty-printed logs like:
# [10:20:10.018] INFO (enrichment-worker): Worker environment initialized
```

## Dependencies Added

### `packages/logger/package.json`
```json
{
  "dependencies": {
    "pino": "^8.21.0",
    "pino-pretty": "^11.0.0"
  }
}
```

### `packages/workers/package.json`
```json
{
  "dependencies": {
    "@aec/logger": "workspace:*"
  }
}
```

### `apps/dashboard/package.json`
```json
{
  "dependencies": {
    "@aec/logger": "workspace:*"
  }
}
```

## References

- [Pino Documentation](https://github.com/pinojs/pino)
- [Pino Best Practices](https://github.com/pinojs/pino/blob/master/docs/best-practices.md)
- [Logger Package README](../packages/logger/README.md)

## Conclusion

The structured logging implementation is complete and ready for use. All workers and API handlers now use the centralized `@aec/logger` package, providing:

- Consistent logging format across all services
- Better debugging in development
- Production-ready JSON logs
- Type-safe API
- High performance

No further action is required. The system is ready for deployment.
