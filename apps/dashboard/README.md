# Scrimspec Dashboard

Web-based UI for YouTube video ingestion, analysis, and short-form video generation.

## Features

- **YouTube Ingestion**: Search and ingest videos from YouTube by keywords
- **Video Analysis**: Run emotional architecture analysis on ingested videos
- **Job Management**: Asynchronous job queues for long-running operations
- **Results Display**: View analysis results and generated videos

## Getting Started

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- pnpm 8+

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Visit `http://localhost:3000` to access the dashboard.

### Building

```bash
pnpm build
pnpm start
```

## Project Structure

```
app/
├── layout.tsx          # Root layout with navigation
├── page.tsx            # Home page
├── ingest/
│   └── page.tsx        # Ingest videos form
├── analysis/
│   └── page.tsx        # Analyze videos page
└── api/
    ├── ingest/
    │   └── jobs/route.ts     # POST/GET ingest jobs
    └── analysis/
        └── jobs/route.ts     # POST/GET analysis jobs
```

## API Routes

### Ingest Jobs

- **POST /api/ingest/jobs** - Create a new ingest job
  ```json
  {
    "query": "emotional architecture",
    "publishedAfter": "2024-01-01T00:00:00Z",
    "duration": "short"
  }
  ```

- **GET /api/ingest/jobs** - List ingest jobs

### Analysis Jobs

- **POST /api/analysis/jobs** - Create analysis jobs
  ```json
  {
    "videoIds": ["dQw4w9WgXcQ", "..."],
    "analyzer": "gemini"
  }
  ```

- **GET /api/analysis/jobs** - List analysis jobs

## Database

This dashboard uses the Scrimspec database schema:

- `youtube_videos` - YouTube video metadata
- `video_analysis` - Analysis results
- `ingest_queue` - YouTube ingestion job queue
- `analysis_queue` - Video analysis job queue

## Environment Variables

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
YOUTUBE_API_KEY=...
GEMINI_API_KEY=...
```

## Development Notes

- Use TypeScript for all code
- Follow the existing code style
- Test API routes locally before deployment
- Keep components simple and focused

## Future Enhancements

- [ ] Real-time job status updates with WebSockets
- [ ] Video preview and streaming
- [ ] Advanced filtering and search
- [ ] User authentication and per-user quotas
- [ ] Performance monitoring and analytics
