# @scrimspec/workers

Background workers for Scrimspec video processing system.

## Workers

### Ingest Worker

Processes YouTube video ingest jobs from the `jobs.ingest_job_queue` table.

**Features:**
- Safely captures pending jobs using `SELECT FOR UPDATE SKIP LOCKED`
- Searches YouTube API with all configurable parameters
- Saves/updates video metadata in `youtube_videos` table
- Handles errors with retry logic
- Continuous polling with 10-second idle delay

**Environment Variables:**
- `YOUTUBE_API_KEY` - YouTube Data API v3 key (required)
- `DATABASE_URL` - PostgreSQL connection string (required)

**Usage:**

```bash
# Development mode with auto-reload
pnpm dev:ingest

# Build
pnpm build

# Type check
pnpm type-check
```

## Architecture

- **Database**: Uses Drizzle ORM with `@scrimspec/db` package
- **Job Queue**: PostgreSQL-based queue with status tracking
- **Error Handling**: Failed jobs are marked with error messages for debugging
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals
