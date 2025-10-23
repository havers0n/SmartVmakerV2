# YouTube Orchestrator - Python Workers

Background job workers for YouTube video ingestion and analysis in the Scrimspec system.

## Overview

This directory contains long-running Python workers that process asynchronous jobs:

1. **ingest_worker.py** - Searches YouTube for videos and stores metadata
2. **analysis_worker.py** - Analyzes videos using different backends (Gemini, etc.)

Both workers poll the database job queues (`ingest_queue` and `analysis_queue`) and process pending jobs.

## Setup

### Prerequisites

- Python 3.8+
- PostgreSQL database
- YouTube Data API v3 key (for ingest worker)
- Gemini API key (for analysis with Gemini)

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in this directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/scrimspec

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here

# Gemini API (optional, for analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (optional, for artifact storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Running Workers

### Ingest Worker

Searches YouTube for videos based on ingest queue jobs:

```bash
python workers/ingest_worker.py
```

**Features:**
- Searches YouTube API for videos matching query
- Fetches video metadata (title, description, stats)
- Stores videos in `youtube_videos` table
- Updates job status to 'done' or 'failed'
- Automatic retry on error

**Job Input:**
```json
{
  "query": "emotional architecture",
  "publishedAfter": "2024-01-01T00:00:00Z",
  "duration": "short"
}
```

### Analysis Worker

Analyzes videos using different analyzers:

```bash
python workers/analysis_worker.py
```

**Features:**
- Gets pending analysis jobs from queue
- Runs analysis using specified analyzer (Gemini, etc.)
- Saves analysis results to JSON files
- Uploads artifacts to Supabase Storage
- Stores metadata in `video_analysis` table
- Updates job status

**Job Input:**
```json
{
  "videoIds": ["dQw4w9WgXcQ"],
  "analyzer": "gemini"
}
```

## Running Both Workers (Local Development)

In separate terminal windows:

```bash
# Terminal 1: Ingest worker
python workers/ingest_worker.py

# Terminal 2: Analysis worker
python workers/analysis_worker.py
```

Or run them together with a process manager like PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start both workers
pm2 start workers/ingest_worker.py --name ingest-worker
pm2 start workers/analysis_worker.py --name analysis-worker

# Monitor
pm2 logs

# Stop
pm2 kill
```

## Running Workers in Docker

Dockerfile example (create in this directory):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY workers/ ./workers/

CMD ["python", "-u", "workers/${WORKER_TYPE}.py"]
```

Build and run:

```bash
# Ingest worker
docker build -t scrimspec-ingest-worker .
docker run -e WORKER_TYPE=ingest_worker -e DATABASE_URL=... scrimspec-ingest-worker

# Analysis worker
docker run -e WORKER_TYPE=analysis_worker -e DATABASE_URL=... scrimspec-ingest-worker
```

## Production Deployment

### Using Supervisor

Create `/etc/supervisor/conf.d/scrimspec-workers.conf`:

```ini
[program:ingest-worker]
command=python /opt/scrimspec/workers/ingest_worker.py
user=scrimspec
directory=/opt/scrimspec/workers
redirect_stderr=true
stdout_logfile=/var/log/scrimspec/ingest-worker.log
autostart=true
autorestart=true
startsecs=10

[program:analysis-worker]
command=python /opt/scrimspec/workers/analysis_worker.py
user=scrimspec
directory=/opt/scrimspec/workers
redirect_stderr=true
stdout_logfile=/var/log/scrimspec/analysis-worker.log
autostart=true
autorestart=true
startsecs=10
```

Reload and start:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start ingest-worker analysis-worker
```

### Using systemd

Create `/etc/systemd/system/scrimspec-ingest-worker.service`:

```ini
[Unit]
Description=Scrimspec Ingest Worker
After=network.target

[Service]
Type=simple
User=scrimspec
WorkingDirectory=/opt/scrimspec/workers
ExecStart=/opt/scrimspec/venv/bin/python /opt/scrimspec/workers/ingest_worker.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable scrimspec-ingest-worker
sudo systemctl start scrimspec-ingest-worker
```

## Job Queue Flow

```
User submits ingest job via API
    ↓
Job stored in ingest_queue with status='pending'
    ↓
ingest_worker polls and finds job
    ↓
Worker marks status='processing'
    ↓
Worker searches YouTube and fetches metadata
    ↓
Worker stores videos in youtube_videos table
    ↓
Worker marks status='done' or 'failed'
    ↓
UI polls job status and displays results
```

## Monitoring

### Check job status

```sql
-- Pending ingest jobs
SELECT id, query, status, created_at FROM ingest_queue WHERE status='pending';

-- Completed jobs
SELECT id, query, status, created_at FROM ingest_queue WHERE status='done' ORDER BY updated_at DESC LIMIT 10;

-- Failed jobs
SELECT id, query, status, error, updated_at FROM ingest_queue WHERE status='failed';
```

### Log aggregation

Logs go to stdout/stderr and can be captured by:
- Docker: `docker logs <container>`
- systemd: `journalctl -u scrimspec-ingest-worker -f`
- Supervisor: `/var/log/scrimspec/*.log`

## Troubleshooting

### Database Connection Error

```
psycopg2.OperationalError: could not connect to server
```

- Check DATABASE_URL is correct
- Verify PostgreSQL is running
- Check network connectivity

### YouTube API Error

```
googleapiclient.errors.HttpError: <HttpError 403>
```

- Check YOUTUBE_API_KEY is valid
- Check API quotas in Google Cloud Console
- Ensure YouTube Data API v3 is enabled

### No Jobs Processing

- Check job queue is not empty: `SELECT COUNT(*) FROM ingest_queue WHERE status='pending';`
- Check worker logs for errors
- Verify database connection from worker

## Contributing

To add a new analyzer:

1. Add method to `VideoAnalyzer` class (e.g., `_analyze_with_custom()`)
2. Update `analyze()` method to route to new analyzer
3. Document in this README

## License

MIT License - See LICENSE file in project root
