# HWAR Database Setup & Health Checks

## Overview

This document describes the database integration, health checks, and migration setup for the HelloWhoAreYou (HWAR) feature.

## Changes Applied

### 1. Database Health Check API

**Endpoint:** `GET /api/health/db`

**Response:**
```json
{
  "ok": true,
  "now": "2025-01-25T10:30:00.000Z",
  "provider": "drizzle+pg"
}
```

**Implementation:** `apps/dashboard/app/api/health/db/route.ts`
- Uses Node.js runtime
- Executes lightweight `SELECT now()` query
- Type-safe responses
- No credentials in logs/responses

### 2. Dev Smoke Test Page

**Route:** `/hwar/dev`

**Features:**
- Tests DB health endpoint
- Tests HWAR harvests endpoint
- Client-side queries using TanStack Query
- Real-time error display
- Manual refresh capability
- Test instructions

**Implementation:** `apps/dashboard/app/hwar/dev/page.tsx`

### 3. Database Migrations

**Generated Migrations:**

1. `0001_panoramic_tinkerer.sql` - Initial HWAR tables
   - `hwar_scenarios` (id, topic, durationSec, tags, createdAt)
   - `hwar_harvests` (id, query, createdAt)

2. `0002_abandoned_may_parker.sql` - Schema hardening
   - Added indexes on `createdAt` for both tables
   - Added index on `topic` for scenarios
   - Added CHECK constraint: `durationSec BETWEEN 5 AND 300`
   - Set default `[]` for tags field

**To Apply Migrations:**

```bash
# Method 1: Using the migration runner
cd packages/db
pnpm migrate:run

# Method 2: Manual SQL execution
psql $DATABASE_URL -f packages/db/migrations/0001_panoramic_tinkerer.sql
psql $DATABASE_URL -f packages/db/migrations/0002_abandoned_may_parker.sql
```

**Requirements:**
- Set `DATABASE_URL` environment variable
- Connection uses SSL in production (`ssl: { rejectUnauthorized: false }`)

### 4. Schema Hardening

**Improvements:**
- **Indexes:** Improved query performance on timestamp-based queries and topic searches
- **Constraints:** Duration validation (5-300 seconds) at database level
- **Defaults:** Empty array default for tags prevents null issues
- **Type Safety:** Full TypeScript inference for all operations

**Schema Location:** `packages/db/src/schema/hwar.ts`

### 5. Type-Safe Response Helpers

**Helper Functions:** `apps/dashboard/src/lib/http.ts`

```typescript
import { badRequest, serverError } from "@/src/lib/http";

// Usage in API routes
if (!validation.success) {
  return badRequest(validation.error);
}

// Consistent error normalization
return serverError(error);
```

**Benefits:**
- Consistent error formatting across all endpoints
- No credential leakage
- Type-safe error responses
- Clean logging

### 6. Refactored API Routes

All HWAR API routes now use:
- ✅ Node.js runtime (`export const runtime = "nodejs"`)
- ✅ Type-safe `NextResponse.json<T>()`
- ✅ Centralized error helpers
- ✅ Real Drizzle database operations
- ✅ Proper connection pooling with hot-reload support

## Verification Checklist

### Type Safety
```bash
pnpm -w typecheck
```
✅ All HWAR code passes (pre-existing orchestrator errors remain)

### Manual Testing

1. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health/db
   # Expected: {"ok":true,"now":"2025-...","provider":"drizzle+pg"}
   ```

2. **Dev Smoke Page:**
   - Navigate to http://localhost:3000/hwar/dev
   - Should see `ok: true` in both health and harvests sections

3. **Create Scenario:**
   - Go to http://localhost:3000/hwar/create
   - Fill in: topic, duration (5-300), tags
   - Submit and verify success response
   - Check `/hwar/dev` to see persisted data

### E2E Testing

**Test File:** `apps/dashboard/tests/hwar-db-health.spec.ts`

```bash
pnpm --filter apps/dashboard test:e2e
```

Test verifies `/hwar/dev` page shows `"ok": true` message.

## Database Schema

### hwar_scenarios

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| topic | text | NOT NULL |
| duration_sec | integer | NOT NULL, CHECK (5-300) |
| tags | jsonb | NOT NULL, DEFAULT '[]' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:**
- `hwar_scenarios_created_at_idx` (created_at)
- `hwar_scenarios_topic_idx` (topic)

### hwar_harvests

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| query | text | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Indexes:**
- `hwar_harvests_created_at_idx` (created_at)

## Connection Management

**Pooling Strategy:**
- Single PostgreSQL pool instance using `globalThis` pattern
- Survives Next.js hot reloads in development
- Automatic SSL in production
- Reused across all HWAR API routes

**Implementation:**
- `packages/db/src/client.ts` - Global pool with hot-reload support
- `apps/dashboard/src/lib/db.ts` - Dashboard-specific wrapper

## Next Steps

1. Configure `DATABASE_URL` in your environment
2. Run migrations: `cd packages/db && pnpm migrate:run`
3. Start dev server: `pnpm --filter apps/dashboard dev`
4. Test at http://localhost:3000/hwar/dev
5. Create test scenarios via http://localhost:3000/hwar/create

## Troubleshooting

**Migration Fails:**
- Verify `DATABASE_URL` is set correctly
- Check database connectivity
- Ensure user has CREATE TABLE permissions

**Health Check Returns Error:**
- Check `DATABASE_URL` environment variable
- Verify database is running
- Check network/firewall rules

**Type Errors:**
- Run `pnpm -w build` to ensure packages are built
- Check that drizzle-orm versions match (0.29.1)

## Architecture Benefits

✅ **Type Safety:** Full TypeScript inference from DB to API
✅ **Performance:** Indexes on common query patterns
✅ **Data Integrity:** CHECK constraints prevent invalid data
✅ **Developer Experience:** Hot-reload friendly, clear error messages
✅ **Production Ready:** SSL support, connection pooling, proper error handling
