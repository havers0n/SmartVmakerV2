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

### Analysis Worker

Analyzes videos using Gemini AI to extract emotional architecture and storytelling elements.

**Features:**
- Safely captures pending jobs using `SELECT FOR UPDATE SKIP LOCKED`
- Duplicate detection - skips videos already analyzed
- Calls Gemini API with structured prompt
- Robust JSON extraction from Gemini response (handles markdown blocks)
- Saves detailed analysis results to `analysis_results` table
- Comprehensive error handling with job status tracking

**What it analyzes:**
- `hook_text` - Opening hook of the video
- `emotion_tags` - Array of 5 emotion tags
- `beats` - Timeline of emotional beats with time, description, and emotion
- `payoff` - The payoff/resolution
- `moral` - The moral or takeaway

**Environment Variables:**
- `GEMINI_API_KEY` - Google Gemini API key (required)
- `DATABASE_URL` - PostgreSQL connection string (required)

**Usage:**

```bash
# Development mode with auto-reload
pnpm dev:analysis
```

**How it works:**
1. Atomically captures a pending job from `jobs.analysis_job_queue`
2. Checks if video already analyzed (duplicate protection)
3. Fetches video URL from `youtube_videos` table
4. Constructs structured prompt for Gemini API
5. Calls Gemini API with video URL
6. Extracts and parses JSON from response (handles markdown)
7. Validates analysis result structure
8. Saves to `analysis_results` table with full breakdown
9. Marks job as completed or failed with error details

**API Integration:**
- Model: `gemini-2.0-flash-exp`
- Temperature: 0.7
- Max tokens: 2048
- Format: Structured JSON output

## Commands

```bash
# Development mode with auto-reload
pnpm dev:ingest    # Start ingest worker
pnpm dev:enrich    # Start enrichment worker
pnpm dev:analysis  # Start analysis worker

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
