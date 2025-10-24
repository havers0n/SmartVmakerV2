# Database Status Report

## Current State

### ✅ Successfully Created Tables
- `tasks` - но со сниженной схемой
- `youtube_videos`
- `analysis_queue`
- `video_analysis`
- `ingest_queue`
- `generation_events`

### ❌ Migration Issue: 0000_medical_nicolaos

**Problem:** The migration tries to create/modify the `tasks` table with additional columns that are missing:
- `batch_id` (text) - для связи задач в батчи
- `params` (jsonb) - для дополнительных параметров
- `file_id` (text) - ссылка на файл
- `error` (text) - текст ошибки
- `topic` (text) - тема видео
- `lang` (text) - язык

**Root Cause:**
1. `FINAL_SETUP.sql` создал таблицу `tasks` с `CREATE TABLE IF NOT EXISTS`
2. Миграция `0000_medical_nicolaos.sql` содержит другую схему таблицы
3. Когда миграция пытается создать индекс на `batch_id`, столбца не существует → ошибка

## Solution

### Option 1: Run SQL Fix in Supabase Dashboard (Recommended Now)

```sql
-- Copy content from FIX_MIGRATION_0000_MEDICAL.sql and run in Supabase SQL Editor
```

Steps:
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Open SQL Editor
3. Copy content from `FIX_MIGRATION_0000_MEDICAL.sql`
4. Run the script

### Option 2: Re-initialize Database (If You Want Clean Start)

Drop tables and let migrations run:
```sql
DROP TABLE IF EXISTS "clips" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.jobs" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.assets" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.shorts" CASCADE;
DROP TABLE IF EXISTS "assets" CASCADE;
DROP TABLE IF EXISTS "batches" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "video_analysis" CASCADE;
DROP TABLE IF EXISTS "analysis_queue" CASCADE;
DROP TABLE IF EXISTS "ingest_queue" CASCADE;
DROP TABLE IF EXISTS "youtube_videos" CASCADE;
DROP TABLE IF EXISTS "generation_events" CASCADE;
```

Then apply `0000_medical_nicolaos.sql` migration.

## Schema Comparison

### Current Schema (from FINAL_SETUP.sql)
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  kind TEXT,
  status TEXT,
  prompt TEXT,
  public_url TEXT,
  started_at TIMESTAMP DEFAULT now(),
  finished_at TIMESTAMP
)
```

### Expected Schema (from migration 0000_medical)
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  prompt TEXT,
  params JSONB,
  file_id TEXT,
  public_url TEXT,
  error TEXT,
  batch_id TEXT,
  topic TEXT,
  lang TEXT,
  started_at TIMESTAMP DEFAULT now() NOT NULL,
  finished_at TIMESTAMP
)
```

## Complete Table Inventory

### From packages/db/src/schema/ (Drizzle ORM)

| Table | Status | Issue | Schema File |
|-------|--------|-------|-------------|
| `tasks` | ⚠️ INCOMPLETE | Missing 6 columns | tasks.ts |
| `batches` | ✅ OK | Complete | batches.ts |
| `assets` | ✅ OK | Complete | assets.ts |
| `clips` | ✅ OK | Has FK to tasks | clips.ts |
| `youtube_videos` | ✅ OK | Complete | youtube.ts |
| `video_analysis` | ✅ OK | Complete | youtube.ts |
| `ingest_queue` | ✅ OK | Complete | jobs.ts |
| `analysis_queue` | ✅ OK | Complete | jobs.ts |
| `generation_pipeline.shorts` | ✅ OK | Complete | generation.ts |
| `generation_pipeline.assets` | ✅ OK | Complete | generation.ts |
| `generation_pipeline.jobs` | ✅ OK | Complete | generation.ts |

### Missing from Database

None - all expected tables exist but `tasks` is incomplete.

### Tasks Table - Expected vs Actual

**Expected columns (from tasks.ts):**
1. ✅ id (text, PK)
2. ✅ kind (text, NOT NULL) - Type: TaskKind
3. ✅ status (text, NOT NULL) - Type: TaskStatus
4. ✅ prompt (text)
5. ❌ params (jsonb) - **MISSING**
6. ❌ fileId → file_id (text) - **MISSING**
7. ✅ publicUrl → public_url (text)
8. ❌ errorText → error (text) - **MISSING**
9. ❌ batchId → batch_id (text) - **MISSING**
10. ❌ topic (text) - **MISSING**
11. ❌ lang (text) - **MISSING**
12. ✅ startedAt → started_at (timestamp, NOT NULL)
13. ✅ finishedAt → finished_at (timestamp)

**Indexes:**
- ✅ idx_tasks_status (on status)
- ❌ idx_tasks_batch (on batch_id) - **MISSING**

## Next Steps

1. **Execute** `FIX_MIGRATION_0000_MEDICAL.sql` in Supabase Dashboard
2. **Verify** column existence with query from the fix script
3. **Apply** remaining migrations (if any)
4. **Consider** consolidating setup in future: either use migrations exclusively or SQL setup files, not both

## Files

- `FINAL_SETUP.sql` - Manual table creation (applied ✓)
- `packages/db/migrations/0000_medical_nicolaos.sql` - Schema definition (needs completion ⏳)
- `FIX_MIGRATION_0000_MEDICAL.sql` - Generated fix script (NEW)
