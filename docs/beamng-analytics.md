# BeamNG Analytics — PR-1

## Purpose

Add YouTube channel management, computed video metrics, and basic analytics tables/pages for BeamNG.drive niche research, reusing the existing Scrimspec ingest and database infrastructure.

## Changes

### New Tables (Drizzle schema: `packages/db/migrations/schema.ts`)

| Table | Purpose |
|---|---|
| `youtube_channels` | Normalized YouTube channel data with metadata (subs, video count, views) |
| `import_sessions` | Tracks batch imports of channels/videos (source, status, counts) |

### Modified Tables

| Table | Change |
|---|---|
| `youtube_videos` | Added `channel_id` FK → `youtube_channels.id` (keeps existing `channelTitle` for backward compat) |

### New Columns on `youtube_channels`

- `id` uuid PK
- `youtube_channel_id` text unique
- `handle` text (e.g., `@BeamNGGames`)
- `title`, `description`, `country`
- `subscriber_count`, `video_count`, `view_count`
- `published_at`, `thumbnail_url`
- `created_at`, `updated_at`

### New Columns on `import_sessions`

- `id` uuid PK
- `source` text (e.g., `"channel_csv"`, `"youtube_search"`)
- `status` text (pending / processing / completed / failed)
- `started_at`, `finished_at`
- `total_channels`, `total_videos`
- `error_message`, `meta` jsonb

## Computed Metrics (no separate table)

Defined in `apps/dashboard/src/shared/lib/beamng-metrics.ts`:

| Metric | Formula |
|---|---|
| `viewsPerDay` | `viewCount / ageDays` |
| `likesPer1000Views` | `(likeCount / viewCount) * 1000` |
| `commentsPer1000Views` | `(commentCount / viewCount) * 1000` |
| `engagementRate` | `((likes + comments) / viewCount) * 100` |
| `videoAgeDays` | `now - publishedAt` in days |

All computed on-the-fly in the API layer — no DB triggers or extra storage.

## API Endpoints

### `GET /api/beamng/videos`

Returns ingested videos with channel info and computed metrics.

**Query params:**
- `limit` (default 50, max 500)
- `offset` (default 0)
- `sortBy`: `views`, `publishedAt`, `viewsPerDay`, `durationSeconds`, `title`
- `sortDir`: `asc` / `desc`
- `channelId`: filter by channel UUID
- `minViews`: filter by minimum view count
- `search`: text search in title

**Response:**
```json
{
  "success": true,
  "videos": [{
    "id": "uuid",
    "title": "...",
    "viewCount": 12345,
    "channelTitle": "...",
    "channel": { "youtubeChannelId": "UC...", "handle": "@...", "subscriberCount": 1000 },
    "metrics": {
      "viewsPerDay": 123.4,
      "likesPer1000Views": 45.2,
      "commentsPer1000Views": 3.1,
      "engagementRate": 4.83,
      "videoAgeDays": 100.2
    },
    ...
  }],
  "total": 500,
  "pagination": { "limit": 50, "offset": 0 }
}
```

### `GET /api/beamng/channels`

Returns channels with aggregate video statistics.

**Query params:**
- `limit` (default 50, max 200)
- `offset` (default 0)
- `sortBy`: `title`, `subscriberCount`, `videoCount`, `viewCount`, `avgViewsPerVideo`, `latestVideoDate`
- `sortDir`: `asc` / `desc`
- `search`: text search in title

**Response:**
```json
{
  "success": true,
  "channels": [{
    "id": "uuid",
    "youtubeChannelId": "UC...",
    "handle": "@BeamNG",
    "title": "BeamNG",
    "subscriberCount": 500000,
    "aggregates": {
      "totalVideos": 150,
      "totalViews": 50000000,
      "avgViewsPerVideo": 333333,
      "avgViewsPerDay": 10000,
      "latestVideoDate": "2026-06-30T..."
    }
  }],
  "total": 20,
  "pagination": { "limit": 50, "offset": 0 }
}
```

## Frontend Pages

| Route | File | Description |
|---|---|---|
| `/beamng/videos` | `apps/dashboard/src/app/beamng/videos/page.tsx` | Table with all ingested videos, computed metrics, sortable columns |
| `/beamng/channels` | `apps/dashboard/src/app/beamng/channels/page.tsx` | Table with channels and aggregate metrics |

Sidebar has a new "BeamNG Analytics" section with links to both pages.

## How to Test

### 1. Apply migrations

```bash
cd packages/db
npx drizzle-kit push
```

Or run the SQL file manually against your Supabase/PostgreSQL instance.

### 2. Insert test data

```sql
-- Insert a channel
INSERT INTO youtube_channels (youtube_channel_id, handle, title, subscriber_count, video_count, view_count, published_at)
VALUES ('UCBeamNG', '@BeamNG', 'BeamNG Official', 500000, 200, 100000000, '2015-07-01T00:00:00Z');

-- Link existing videos to the channel
UPDATE youtube_videos SET channel_id = (SELECT id FROM youtube_channels WHERE youtube_channel_id = 'UCBeamNG')
WHERE youtube_id IN ('video1', 'video2');
```

### 3. Verify API

```bash
# List videos
curl http://localhost:3000/api/beamng/videos?limit=5

# List channels
curl http://localhost:3000/api/beamng/channels
```

### 4. Open UI

Navigate to `/beamng/videos` and `/beamng/channels` in the dashboard.

## File Map (new/changed)

```
packages/db/migrations/
  schema.ts                          # +youtubeChannels, +importSessions, +channelId FK
  0012_beamng_analytics.sql          # New migration

apps/dashboard/src/
  shared/lib/
    beamng-metrics.ts                # NEW: computed metrics service
    schema.ts                        # +youtubeChannels, +importSessions re-exports
  app/
    layout.tsx                       # +BeamNG sidebar section
    api/beamng/
      videos/route.ts                # NEW: GET /api/beamng/videos
      channels/route.ts              # NEW: GET /api/beamng/channels
    beamng/
      videos/page.tsx                # NEW: videos table page
      channels/page.tsx              # NEW: channels table page

docs/
  beamng-analytics.md                # This file
```

## Known Limitations

1. **Migration 0011 missing from journal** — `0011_hwar_workers_typed.sql` exists but has no journal entry. If you get `Missing migration: 0011_hwar_workers_typed`, run `drizzle-kit up` or add it manually as I've done for 0012.
2. **No auth on /api/beamng/** — Currently no admin check (unlike `/api/videos`). Add `getTrustedUserId` + `isAdminUser` later.
3. **Metrics are computed in API, not cached** — For >10K videos, consider adding a `video_metrics` materialized view or caching layer.
4. **`channelId` FK is SET NULL on delete** — Deleting a channel won't cascade-delete videos; they just lose their channel link.
5. **No channel import UI yet** — The `/beamng/channels` page shows data but there's no form to add channels. Use SQL or the Python `collect_all_videos_from_channels.py` tool.
6. **`viewsPerDay` sorting** — The `sortBy=viewsPerDay` parameter is accepted but sorting is delegated to the DB which doesn't know this computed field. Will sort by `publishedAt` as fallback.
