# Phase 3: Generation & Integration - Setup Guide

This guide covers the setup and configuration needed to run Phase 3 of Scrimspec.

## Overview

Phase 3 closes the loop: **data → insight → generation → feedback**

Components:
- **Supabase Storage** for analysis artifacts
- **Generation Pipeline** (shorts, assets, job queue)
- **Orchestrator** for creating shorts and managing jobs
- **Generation Worker** for calling MiniMax/Hailuo APIs
- **Dashboard UI** for monitoring and triggering generation
- **E2E Tests** for validating the workflow

## Prerequisites

### System Requirements
- Node.js >= 18.0.0
- PostgreSQL 13+ (or Supabase)
- Python 3.8+ (for analysis workers)
- pnpm >= 8.0.0

### External Services (Optional but Recommended)
- **MiniMax API Key** - For video generation
- **Hailuo API Key** - Alternative video generation provider
- **Supabase Project** - For Storage bucket
- **Google Gemini API** - For video analysis

## Setup Steps

### 1. Clone and Install

```bash
git clone https://github.com/anthropics/scrimspec.git
cd scrimspec
pnpm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database
createdb scrimspec

# Set connection string
export DATABASE_URL="postgresql://user:password@localhost:5432/scrimspec"
```

#### Option B: Supabase

1. Create a Supabase project at https://supabase.com
2. Get connection string from project settings
3. Create Storage bucket: `analysis`

```bash
export DATABASE_URL="postgresql://postgres:password@host.supabase.co:5432/postgres"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="sbp_..."
```

### 3. Environment Configuration

Copy and configure `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Core
DATABASE_URL=postgresql://user:password@localhost:5432/scrimspec
NODE_ENV=development

# Supabase (for Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=sbp_...
STORAGE_BUCKET=analysis

# MiniMax API (for video generation)
MINIMAX_API_KEY=sk-...

# Dashboard (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Python tools
DATABASE_URL=postgresql://user:password@localhost:5432/scrimspec
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=sbp_...
YOUTUBE_API_KEY=your-key
GEMINI_API_KEY=your-key
```

### 4. Database Migration

Create the generation pipeline tables:

```bash
# Drizzle is already configured, verify tables are created
# The schema is in: packages/db/src/schema/generation.ts

pnpm run type-check  # Verify TypeScript
```

The tables will be created when the app first connects to the database:
- `generation_pipeline.shorts` - Short records
- `generation_pipeline.assets` - Asset records
- `generation_pipeline.jobs` - Job queue

### 5. Python Dependencies (for analysis worker)

```bash
cd tools/yt-orchestrator-python
pip install -r requirements.txt
```

Key dependencies:
- `supabase==2.3.5` - Supabase client
- `psycopg2-binary==2.9.9` - PostgreSQL adapter
- `google-generativeai==0.3.0` - Gemini API

### 6. Start Services

#### Terminal 1: Dashboard App

```bash
npm run dev
# Starts on http://localhost:3000
```

#### Terminal 2: Generation Worker (Optional)

```bash
cd packages/orchestrator
npm run worker
# Starts polling the job queue every 5 seconds
```

#### Terminal 3: Analysis Worker (Optional)

```bash
cd tools/yt-orchestrator-python
python workers/analysis_worker.py
# Starts polling the analysis queue
```

## Configuration Details

### MiniMax API

1. Sign up at https://platform.minimax.io
2. Get API key from dashboard
3. Set `MINIMAX_API_KEY` in `.env`

**Current Status:** Mock implementation (development)

See `packages/orchestrator/src/providers/minimax.ts` for production implementation.

### Hailuo API

Similar to MiniMax. Alternative provider for video generation.

See `packages/orchestrator/src/providers/hailuo.ts`

### Supabase Storage

1. Create Supabase project
2. Create storage bucket named `analysis`
3. Set bucket to public (allow read-only access)
4. Add CORS configuration to allow your domain

**Setup:**
```sql
-- In Supabase SQL editor
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'analysis');

CREATE POLICY "Allow service role full access"
ON storage.objects
USING (auth.role() = 'service_role');
```

### Generation Worker Configuration

Environment variables:

```env
# Poll interval in milliseconds (default: 5000)
POLL_INTERVAL_MS=5000

# Maximum retries per job (default: 3)
MAX_RETRIES=3

# Database connection
DATABASE_URL=postgresql://...

# Provider credentials
MINIMAX_API_KEY=sk-...
HAILUO_API_KEY=...
```

## Usage

### 1. Create a Short via Dashboard

1. Navigate to http://localhost:3000/generation
2. Enter a Template ID (e.g., `template-001`)
3. Select Provider (MiniMax or Hailuo)
4. Click "Create Short"

### 2. Monitor Generation

- View shorts and assets on the Generation page
- Enable "Auto-refresh" to update every 3 seconds
- Check asset status (pending → processing → completed)

### 3. Access Generated Assets

Once completed, click "View" link next to asset to see storage URL.

### 4. Run E2E Tests

```bash
cd apps/dashboard

# Run test suite
npm test -- e2e/generation.test.ts

# With custom base URL
BASE_URL=http://localhost:3000 npm test -- e2e/generation.test.ts
```

## Project Structure

```
scrimspec/
├── packages/
│   ├── db/                          # Database schema & client
│   │   └── src/schema/
│   │       └── generation.ts        # Generation pipeline tables
│   └── orchestrator/                # Generation orchestration
│       ├── src/
│       │   ├── services/
│       │   │   └── generationService.ts   # Short/asset creation
│       │   ├── providers/
│       │   │   ├── minimax.ts             # MiniMax API wrapper
│       │   │   └── hailuo.ts              # Hailuo API wrapper
│       │   └── workers/
│       │       └── generationWorker.ts    # Job queue processor
│       └── package.json
├── apps/
│   └── dashboard/                   # Next.js dashboard
│       ├── app/
│       │   ├── generation/
│       │   │   └── page.tsx         # Generation UI
│       │   └── api/
│       │       └── generation/      # Generation API routes
│       ├── e2e/
│       │   └── generation.test.ts   # E2E tests
│       └── package.json
└── tools/
    └── yt-orchestrator-python/     # Python analysis tools
        ├── workers/
        │   └── analysis_worker.py   # Analysis job processor
        ├── storage.py               # Supabase storage helper
        └── requirements.txt
```

## API Endpoints

### POST /api/generation/shorts

Create a new short and enqueue assets for generation.

```bash
curl -X POST http://localhost:3000/api/generation/shorts \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "template-001",
    "provider": "minimax"
  }'
```

Response:
```json
{
  "ok": true,
  "shortId": "uuid-...",
  "enqueued": 5,
  "message": "Created short ... with 5 assets enqueued for generation"
}
```

### GET /api/generation/shorts

List all shorts with asset counts.

```bash
curl http://localhost:3000/api/generation/shorts?limit=50
```

### GET /api/generation/status

Get detailed status of shorts, assets, and jobs.

```bash
curl "http://localhost:3000/api/generation/status?shortId=uuid-...&limit=100"
```

## Troubleshooting

### "Database connection failed"

**Issue:** `Error: Failed to connect to database`

**Solution:**
1. Verify `DATABASE_URL` is set correctly
2. Check PostgreSQL is running: `psql --version`
3. Test connection: `psql "postgresql://..."`

### "MINIMAX_API_KEY not configured"

**Issue:** Generation fails with API key error

**Solution:**
1. For development, the provider uses mocks
2. For production, get API key from MiniMax platform
3. Set `MINIMAX_API_KEY` in `.env`

### "Supabase Storage upload failed"

**Issue:** Analysis worker can't upload to Supabase

**Solution:**
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
2. Check bucket exists and is public
3. Verify CORS configuration
4. Test with: `python tools/yt-orchestrator-python/storage.py`

### "No jobs are being processed"

**Issue:** Generation worker not processing jobs

**Solution:**
1. Verify worker is running: `npm run worker`
2. Check `DATABASE_URL` is same in worker process
3. Look at worker logs for errors
4. Ensure `generation_pipeline.jobs` table exists

## Performance Tuning

### Database Optimization

```sql
-- Add indexes for faster queries
CREATE INDEX idx_generation_queue_status_priority
ON generation_pipeline.jobs(status, created_at);

CREATE INDEX idx_generation_assets_storage_url
ON generation_pipeline.assets(storage_url)
WHERE storage_url IS NOT NULL;
```

### Worker Tuning

```env
# Process more jobs in parallel (increase if CPU allows)
POLL_INTERVAL_MS=2000

# Increase batch size for bulk operations
# (Not yet implemented, for future optimization)
```

## Next Steps

1. **Beat/Template System** - Implement template structure with beats
2. **Cost Tracking** - Track and report generation costs
3. **Quality Metrics** - Collect metrics on generation quality
4. **Advanced Filtering** - Filter by status, date, cost in UI
5. **Batch Operations** - Create multiple shorts at once
6. **Webhooks** - Notify external systems on completion

## Support

For issues or questions:
1. Check logs: `docker logs scrimspec-db`
2. Review config: `cat .env`
3. Check GitHub Issues: https://github.com/anthropics/scrimspec/issues
4. Read docs: https://docs.claude.com/en/docs/claude-code/

## Environment Checklist

Before running Phase 3, ensure:

- [ ] Node.js >= 18.0.0
- [ ] PostgreSQL/Supabase running
- [ ] `DATABASE_URL` configured
- [ ] Supabase Storage bucket created (`analysis`)
- [ ] `.env` file created with all required variables
- [ ] Dependencies installed (`pnpm install`)
- [ ] Dashboard can start (`npm run dev`)
- [ ] Can connect to database

## Security Notes

**Development Only:**
- `.env` contains secrets - never commit to git
- CORS is open - restrict in production
- Supabase anon key is public - use service role key for uploads

**Production:**
- Use environment secrets in CI/CD
- Enable RLS (Row-Level Security) on Supabase tables
- Use signed URLs for storage access
- Implement proper authentication
- Use service role key only on backend

## Additional Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [MiniMax API Docs](https://platform.minimax.io/api-docs)
- [Scrimspec Architecture](./ARCHITECTURE.md)
