# YouTube Ingestion & Analysis System - Complete Guide

## Overview

This document describes the complete YouTube ingestion and video analysis system implemented in Phase 2 of the Scrimspec modernization project.

### What Was Built

A full-stack system for discovering videos on YouTube, ingesting their metadata, and running emotional architecture analysis on them:

```
User UI (Dashboard)
    ↓ HTTP API
Next.js API Routes
    ↓ SQL
PostgreSQL Database
    ↓ Polling
Python Workers (ingest_worker.py, analysis_worker.py)
    ↓ API calls
YouTube API + Gemini API
```

## Architecture

### Components

1. **Database Schema** (`@scrimspec/db`)
   - `youtube_videos` - Stores video metadata from YouTube API
   - `video_analysis` - Stores analysis results
   - `ingest_queue` - Job queue for ingestion tasks
   - `analysis_queue` - Job queue for analysis tasks

2. **Next.js Dashboard** (`apps/dashboard`)
   - `/ingest` - Form to create YouTube search jobs
   - `/analysis` - View ingested videos and create analysis jobs
   - `/api/ingest/jobs` - Endpoint for ingest job management
   - `/api/analysis/jobs` - Endpoint for analysis job management

3. **Python Workers** (`tools/yt-orchestrator-python/workers/`)
   - `ingest_worker.py` - Searches YouTube and stores video metadata
   - `analysis_worker.py` - Analyzes videos and stores results

## Data Flow

### 1. YouTube Ingestion Flow

```
User fills ingest form (query, duration, publishedAfter)
    ↓
POST /api/ingest/jobs
    ↓
Insert into ingest_queue (status='pending')
    ↓
ingest_worker polls and finds pending job
    ↓
Worker marks status='processing'
    ↓
YouTube API: search_video_ids()
    ↓
YouTube API: fetch_video_metadata() for each video
    ↓
INSERT/UPDATE youtube_videos table
    ↓
Mark status='done' or 'failed'
    ↓
UI can fetch videos from youtube_videos table
```

### 2. Video Analysis Flow

```
User selects videos and chooses analyzer (Gemini)
    ↓
POST /api/analysis/jobs with videoIds and analyzer
    ↓
Insert into analysis_queue for each video (status='pending')
    ↓
analysis_worker polls and finds pending job
    ↓
Worker marks status='processing'
    ↓
Fetch video from youtube_videos table
    ↓
Call Gemini API with video URL
    ↓
Analyze emotional architecture
    ↓
Save JSON analysis to local storage
    ↓
[TODO: Upload to Supabase Storage]
    ↓
INSERT video_analysis with analysis_url
    ↓
Mark status='done' or 'failed'
    ↓
UI shows analysis results
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm 8+
- Python 3.8+
- PostgreSQL database (or Supabase)
- YouTube Data API v3 key
- Gemini API key (optional, for analysis)

### Installation

#### 1. Backend Setup

```bash
# Install Node dependencies
pnpm install

# Build TypeScript packages
pnpm build
```

#### 2. Database Setup

```bash
# Create tables (migrations not yet automated)
# Run SQL from the Drizzle schema definitions:
# packages/db/src/schema/jobs.ts
# packages/db/src/schema/youtube.ts
```

#### 3. Python Workers Setup

```bash
cd tools/yt-orchestrator-python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or: venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/scrimspec
YOUTUBE_API_KEY=your_youtube_api_key
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_key
EOF
```

### Running Locally

#### Terminal 1: Start the Dashboard

```bash
cd apps/dashboard
pnpm dev
# Open http://localhost:3000
```

#### Terminal 2: Start Ingest Worker

```bash
cd tools/yt-orchestrator-python
source venv/bin/activate
python workers/ingest_worker.py
```

#### Terminal 3: Start Analysis Worker

```bash
cd tools/yt-orchestrator-python
source venv/bin/activate
python workers/analysis_worker.py
```

### Local Workflow

1. Visit http://localhost:3000
2. Go to `/ingest` page
3. Search for videos: "emotional architecture" or any query
4. Click "Create Ingest Job"
5. Watch terminal 2 (ingest worker) process the job
6. Wait for videos to appear in database
7. Go to `/analysis` page
8. Select videos and choose analyzer
9. Click "Analyze"
10. Watch terminal 3 (analysis worker) process jobs

## Database Schema

### youtube_videos

```sql
CREATE TABLE youtube_videos (
  id TEXT PRIMARY KEY,                    -- YouTube video ID
  url TEXT NOT NULL,                      -- YouTube URL
  title TEXT NOT NULL,                    -- Video title
  description TEXT,                       -- Video description
  published_at TIMESTAMP,                 -- Publish date
  channel_title TEXT,                     -- Channel name
  duration_seconds INTEGER,               -- Video duration in seconds
  view_count BIGINT DEFAULT 0,            -- View count
  like_count BIGINT DEFAULT 0,            -- Like count
  comment_count BIGINT DEFAULT 0,         -- Comment count
  tags JSONB DEFAULT '[]'::jsonb,         -- Video tags as JSON array
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_youtube_videos_published_at ON youtube_videos(published_at);
CREATE INDEX idx_youtube_videos_created_at ON youtube_videos(created_at);
```

### video_analysis

```sql
CREATE TABLE video_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,                 -- YouTube video ID (FK to youtube_videos)
  analyzer TEXT NOT NULL,                 -- Analyzer name (gemini, nanobanana, etc.)
  analysis_url TEXT,                      -- URL to stored analysis JSON
  metadata JSONB,                         -- Analysis metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(video_id, analyzer)
);

CREATE INDEX idx_video_analysis_video_id ON video_analysis(video_id);
CREATE INDEX idx_video_analysis_analyzer ON video_analysis(analyzer);
```

### ingest_queue

```sql
CREATE TABLE ingest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,                    -- Search query
  published_after TIMESTAMP,              -- Min publish date
  duration TEXT DEFAULT 'short' NOT NULL, -- Video duration filter
  status TEXT DEFAULT 'pending' NOT NULL, -- pending, processing, done, failed
  error TEXT,                             -- Error message if failed
  metadata JSONB,                         -- Additional metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ingest_queue_status ON ingest_queue(status);
CREATE INDEX idx_ingest_queue_created_at ON ingest_queue(created_at);
```

### analysis_queue

```sql
CREATE TABLE analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,                 -- YouTube video ID
  analyzer TEXT NOT NULL,                 -- Analyzer name
  status TEXT DEFAULT 'pending' NOT NULL, -- pending, processing, done, failed
  error TEXT,                             -- Error message if failed
  metadata JSONB,                         -- Additional metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysis_queue_video_id ON analysis_queue(video_id);
CREATE INDEX idx_analysis_queue_status ON analysis_queue(status);
CREATE INDEX idx_analysis_queue_analyzer ON analysis_queue(analyzer);
CREATE INDEX idx_analysis_queue_created_at ON analysis_queue(created_at);
```

## API Documentation

### Ingest Jobs API

#### Create Ingest Job

```http
POST /api/ingest/jobs
Content-Type: application/json

{
  "query": "emotional architecture",
  "publishedAfter": "2024-01-01T00:00:00Z",
  "duration": "short"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "pending",
  "message": "Ingest job created: will search for \"emotional architecture\""
}
```

#### Get Ingest Jobs

```http
GET /api/ingest/jobs
```

### Analysis Jobs API

#### Create Analysis Jobs

```http
POST /api/analysis/jobs
Content-Type: application/json

{
  "videoIds": ["dQw4w9WgXcQ", "..."],
  "analyzer": "gemini"
}
```

**Response:**
```json
{
  "success": true,
  "jobIds": ["uuid1", "uuid2"],
  "count": 2,
  "analyzer": "gemini",
  "status": "pending",
  "message": "Created 2 analysis jobs with analyzer: gemini"
}
```

#### Get Analysis Jobs

```http
GET /api/analysis/jobs
```

## Python Worker Details

### ingest_worker.py

**Key Classes:**
- `YouTubeIngestor`: Handles YouTube API v3 calls
  - `search_video_ids()`: Search by query
  - `fetch_video_metadata()`: Get video stats
  - `_parse_iso_duration()`: Parse PT duration strings

- `JobQueue`: PostgreSQL operations
  - `get_pending_job()`: Get next job with locking
  - `update_job_status()`: Update job state
  - `upsert_videos()`: Batch insert/update

**Main Loop:**
- Polls `ingest_queue` for pending jobs
- Searches YouTube API
- Fetches metadata for up to 50 videos per batch
- Stores in `youtube_videos` table
- Updates job status

### analysis_worker.py

**Key Classes:**
- `VideoAnalyzer`: Multi-backend analysis
  - `analyze()`: Route to correct analyzer
  - `_analyze_with_gemini()`: Gemini API analysis
  - `_analyze_with_nanobanana()`: Nanobanana analysis (stub)

- `JobQueue`: Analysis job management
  - `get_pending_job()`: Get next analysis job
  - `get_video()`: Fetch video metadata
  - `save_analysis()`: Store analysis results

- `StorageManager`: Artifact storage
  - `save_analysis()`: Save JSON locally
  - `upload_to_supabase()`: Upload to cloud (stub)

**Main Loop:**
- Polls `analysis_queue` for pending jobs
- Fetches video from `youtube_videos`
- Calls analyzer API (Gemini, etc.)
- Saves analysis JSON
- Updates `video_analysis` table
- Updates job status

## Production Deployment

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY workers/ ./workers/

CMD ["python", "-u", "workers/${WORKER_TYPE}.py"]
```

```bash
# Build
docker build -t scrimspec-workers .

# Run ingest worker
docker run -e WORKER_TYPE=ingest_worker \
  -e DATABASE_URL=postgresql://... \
  -e YOUTUBE_API_KEY=... \
  scrimspec-workers

# Run analysis worker
docker run -e WORKER_TYPE=analysis_worker \
  -e DATABASE_URL=postgresql://... \
  -e GEMINI_API_KEY=... \
  scrimspec-workers
```

### Using PM2

```bash
pm2 start tools/yt-orchestrator-python/workers/ingest_worker.py --name ingest-worker
pm2 start tools/yt-orchestrator-python/workers/analysis_worker.py --name analysis-worker
pm2 save
pm2 startup
```

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `YOUTUBE_API_KEY` - YouTube Data API v3 key (ingest worker)
- `GEMINI_API_KEY` - Gemini API key (analysis worker)

Optional:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `LOG_LEVEL` - Python logging level (default: INFO)

## Known Limitations & TODOs

### Not Yet Implemented

1. **Supabase Storage Upload**: Analysis artifacts are saved locally, not uploaded
   - TODO: Implement `StorageManager.upload_to_supabase()`

2. **Real-time Updates**: No WebSocket for live job status
   - TODO: Add Socket.io or similar for real-time UI updates

3. **Job Status Polling**: UI doesn't yet poll for job completion
   - TODO: Add polling endpoint to Dashboard

4. **Video Display**: Analysis page shows placeholder
   - TODO: Implement `/api/videos` endpoint

5. **Gemini Analysis**: Stub implementation only
   - TODO: Integrate real Gemini API calls

6. **Database Migrations**: Manual SQL setup required
   - TODO: Create Drizzle migration files

7. **Error Recovery**: No automatic retry for failed jobs
   - TODO: Add retry logic with exponential backoff

8. **Rate Limiting**: No YouTube API quota management
   - TODO: Add quota tracking and per-job rate limits

### Performance Optimizations Possible

- Batch video fetches in single API call
- Cache YouTube API responses
- Parallel analysis with worker pool
- Incremental sync for updated video stats
- Analysis result caching

## Testing

### Manual Testing Checklist

- [ ] Create ingest job via /ingest page
- [ ] Verify ingest_worker processes job
- [ ] Check videos appear in youtube_videos table
- [ ] Go to /analysis page
- [ ] Select videos for analysis
- [ ] Verify analysis_worker processes jobs
- [ ] Check results in video_analysis table

### Database Testing

```sql
-- Check pending jobs
SELECT COUNT(*) FROM ingest_queue WHERE status='pending';
SELECT COUNT(*) FROM analysis_queue WHERE status='pending';

-- View recent videos
SELECT id, title, view_count FROM youtube_videos ORDER BY created_at DESC LIMIT 10;

-- View analysis results
SELECT * FROM video_analysis WHERE analyzer='gemini' LIMIT 5;
```

## Statistics

**Phase 2 Deliverables:**

| Component | Files | Lines |
|-----------|-------|-------|
| Database Schema | 2 | 350+ |
| Query Helpers | 1 | 200+ |
| Next.js Dashboard | 6 | 500+ |
| API Routes | 2 | 150 |
| Python Workers | 2 | 1000+ |
| Documentation | 2 | 500+ |
| **Total** | **15** | **2700+** |

**API Endpoints:**
- POST /api/ingest/jobs
- GET /api/ingest/jobs
- POST /api/analysis/jobs
- GET /api/analysis/jobs
- (TODO: GET /api/videos)
- (TODO: GET /api/analysis/:videoId)

## Next Steps

1. **Implement Supabase Storage**: Upload analysis artifacts to cloud
2. **Add real-time updates**: WebSocket for job status
3. **Implement video display**: Show analysis results in UI
4. **Add Gemini integration**: Real analysis instead of stubs
5. **Database migrations**: Auto-create tables
6. **Error handling**: Retry logic and better error messages
7. **Performance**: Caching, batching, optimization
8. **Testing**: Unit tests, integration tests, e2e tests

## Support

For detailed information, see:
- `tools/yt-orchestrator-python/README.md` - Worker setup and deployment
- `apps/dashboard/README.md` - Dashboard setup
- `packages/db/README.md` - Database layer (when available)
- `CONTRIBUTING.md` - Development guidelines

---

**Last Updated:** October 23, 2025
**Status:** Phase 2 Complete - Ready for Phase 3 (Real-time updates & Storage)
