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
```

### Enrichment Worker

Enriches video metadata with detailed statistics and duration information using YouTube API `videos.list` endpoint.

**Features:**
- Batch processing of up to 50 videos per request
- Fetches detailed statistics (view count, like count, comment count)
- Parses ISO 8601 duration format to seconds
- Updates videos with missing or zero view counts
- Continuous polling with 30-second idle delay when no videos need enrichment

**What it enriches:**
- `viewCount` - Total number of views
- `likeCount` - Number of likes
- `commentCount` - Number of comments
- `durationSeconds` - Precise video duration in seconds

**Environment Variables:**
- `YOUTUBE_API_KEY` - YouTube Data API v3 key (required)
- `DATABASE_URL` - PostgreSQL connection string (required)

**Usage:**

```bash
# Development mode with auto-reload
pnpm dev:enrich
```

**How it works:**
1. Finds videos where `viewCount` is NULL or 0
2. Batches up to 50 video IDs for efficient API usage
3. Calls YouTube API `videos.list` with parts: `statistics,contentDetails`
4. Parses ISO 8601 duration (e.g., "PT1M35S" → 95 seconds)
5. Updates database with enriched metadata

## Commands

```bash
# Development mode with auto-reload
pnpm dev:ingest   # Start ingest worker
pnpm dev:enrich   # Start enrichment worker

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
