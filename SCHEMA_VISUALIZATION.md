# Database Schema Visualization

## Current State vs Expected State

### TASKS TABLE - Column Mapping

```
╔════════════════════════════════════════════════════════════════════════════╗
║                          TASKS TABLE SCHEMA                               ║
╠═════════════════╦═════════════════╦═══════╦═══════════════════════════════╣
║ Column Name     ║ Data Type       ║ Exist ║ Status                        ║
╠═════════════════╬═════════════════╬═══════╬═══════════════════════════════╣
║ id              ║ text PK         ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ kind            ║ text NOT NULL   ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ status          ║ text NOT NULL   ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ prompt          ║ text            ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ public_url      ║ text            ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ started_at      ║ timestamp+tz    ║  ✅   ║ Created by FINAL_SETUP.sql    ║
║ finished_at     ║ timestamp+tz    ║  ✅   ║ Created by FINAL_SETUP.sql    ║
├─────────────────┼─────────────────┼───────┼───────────────────────────────┤
║ params          ║ jsonb           ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
║ file_id         ║ text            ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
║ error           ║ text            ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
║ batch_id        ║ text            ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
║ topic           ║ text            ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
║ lang            ║ text            ║  ❌   ║ ⚠️ MISSING - Added by fix     ║
├─────────────────┼─────────────────┼───────┼───────────────────────────────┤
║ Indexes:        ║                 ║       ║                               ║
║  idx_tasks_status      ║  ✅   ║ On 'status' column          ║
║  idx_tasks_batch       ║  ❌   ║ On 'batch_id' - will be added by fix ║
╚═════════════════╩═════════════════╩═══════╩═══════════════════════════════╝
```

## Timeline of Events

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SETUP TIMELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: Initial Setup
┌──────────────────────────────────────┐
│  FINAL_SETUP.sql Executed            │
│  ├─ Creates: tasks (INCOMPLETE)      │
│  ├─ Creates: youtube_videos          │
│  ├─ Creates: analysis_queue          │
│  ├─ Creates: video_analysis          │
│  ├─ Creates: ingest_queue            │
│  └─ Creates: generation_events       │
│                                      │
│  Schema defined in FINAL_SETUP.sql   │
│  (Hand-written SQL)                  │
└──────────────────────────────────────┘
           ↓
       ⚠️ PROBLEM: tasks table missing 6 columns!
           ↓
┌──────────────────────────────────────┐
│  0000_medical_nicolaos.sql Attempted │
│  ├─ Tries: CREATE TABLE tasks...     │
│  │  BUT: Table already exists!       │
│  │  IF NOT EXISTS → Skips creation   │
│  │                                   │
│  ├─ Tries: CREATE INDEX batch_id     │
│  │  BUT: Column doesn't exist!       │
│  └─ ERROR: column "batch_id" does... │
│                                      │
│  Schema defined in migration         │
│  (Drizzle ORM generated)             │
└──────────────────────────────────────┘
           ↓
    ❌ MIGRATION FAILS!
           ↓
┌──────────────────────────────────────┐
│  FIX_MIGRATION_0000_MEDICAL.sql      │
│  ├─ ALTER TABLE tasks ADD COLUMNS    │
│  ├─ Creates: batch_id index          │
│  └─ Verifies: All columns exist      │
│                                      │
│  Applied manually (NEW)              │
└──────────────────────────────────────┘
           ↓
       ✅ FIXED!
           ↓
┌──────────────────────────────────────┐
│  tasks table COMPLETE                │
│  ├─ 7 columns: id, kind, status...   │
│  ├─ 6 new columns: params, file_id.. │
│  ├─ 2 indexes: status, batch         │
│  └─ Ready for application use        │
└──────────────────────────────────────┘
```

## Table Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TABLE RELATIONSHIP DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────┐
                           │   batches   │ (status, timestamps)
                           └──────┬──────┘
                                  │
                                  │ batch_id FK
                                  ↓
╔════════════════════════════════════════════════════════════════════════════╗
║                            TASKS (Central)                                 ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │ id | kind | status | prompt | params | file_id | error | batch_id   │  ║
║  │ topic | lang | public_url | started_at | finished_at                 │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚═════════════────┬═════════════════════════════════════════════════════════╝
                  │
        ┌─────────┼─────────┬──────────────┐
        │         │         │              │
   (PK) │    (FK) │    (FK) │              │ (Reference)
        ↓         ↓         ↓              ↓
   ┌────────┐  ┌──────┐  ┌──────────┐  ┌───────────┐
   │ clips  │  │assets│  │generation│  │ (Other    │
   │        │  │      │  │_pipeline │  │  tables)  │
   │task_id ├──┤      │  │          │  │           │
   │beat_id │  │      │  │shorts    │  │ youtube_  │
   └────────┘  │      │  │assets    │  │ videos    │
               │      │  │jobs      │  │           │
               └──────┘  └──────────┘  └───────────┘
```

## Problem Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE PROBLEM IN A NUTSHELL                            │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE (After FINAL_SETUP.sql):
┌──────────────────────────────┐
│      TASKS TABLE             │
├──────────────────────────────┤
│ ✅ id                        │
│ ✅ kind                      │
│ ✅ status                    │
│ ✅ prompt                    │
│ ✅ public_url                │
│ ✅ started_at                │
│ ✅ finished_at               │
│ ❌ params      (MISSING)     │
│ ❌ file_id     (MISSING)     │
│ ❌ error       (MISSING)     │
│ ❌ batch_id    (MISSING) ← Causes index error!
│ ❌ topic       (MISSING)     │
│ ❌ lang        (MISSING)     │
└──────────────────────────────┘

AFTER (After FIX_MIGRATION_0000_MEDICAL.sql):
┌──────────────────────────────┐
│      TASKS TABLE             │
├──────────────────────────────┤
│ ✅ id                        │
│ ✅ kind                      │
│ ✅ status                    │
│ ✅ prompt                    │
│ ✅ public_url                │
│ ✅ started_at                │
│ ✅ finished_at               │
│ ✅ params                    │
│ ✅ file_id                   │
│ ✅ error                     │
│ ✅ batch_id    (ADDED)       │
│ ✅ topic                     │
│ ✅ lang                      │
└──────────────────────────────┘
```

## Index Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEX CREATION ERROR                                │
└─────────────────────────────────────────────────────────────────────────────┘

0000_medical_nicolaos.sql line 145:
┌──────────────────────────────────────────────────────────┐
│ CREATE INDEX idx_tasks_batch ON "tasks" ("batch_id")     │
└──────────────────────────────────────────────────────────┘
                           ↓
        Database looks for column "batch_id"
                           ↓
                    ❌ NOT FOUND!
                           ↓
        ERROR: column "batch_id" does not exist
                           ↓
        MIGRATION FAILS

After FIX_MIGRATION_0000_MEDICAL.sql runs:
        ✅ Column "batch_id" now exists
        ✅ Index creation would succeed
```

## Solution Effectiveness

```
╔════════════════════════════════════════════════════════════════════════════╗
║              FIX_MIGRATION_0000_MEDICAL.sql - What It Does                ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║ 1. ALTER TABLE "tasks" ADD COLUMN "params" jsonb;                         ║
║    └─ Status: ✅ Adds JSON parameter storage                              ║
║                                                                            ║
║ 2. ALTER TABLE "tasks" ADD COLUMN "file_id" text;                         ║
║    └─ Status: ✅ Enables file tracking                                    ║
║                                                                            ║
║ 3. ALTER TABLE "tasks" ADD COLUMN "error" text;                           ║
║    └─ Status: ✅ Error logging capability                                 ║
║                                                                            ║
║ 4. ALTER TABLE "tasks" ADD COLUMN "batch_id" text;                        ║
║    └─ Status: ✅ Batch processing support (CRITICAL)                      ║
║                                                                            ║
║ 5. ALTER TABLE "tasks" ADD COLUMN "topic" text;                           ║
║    └─ Status: ✅ Topic categorization                                     ║
║                                                                            ║
║ 6. ALTER TABLE "tasks" ADD COLUMN "lang" text;                            ║
║    └─ Status: ✅ Language tracking                                        ║
║                                                                            ║
║ 7. ALTER TABLE "tasks" ALTER COLUMN "kind" SET NOT NULL;                  ║
║    └─ Status: ✅ Enforces data integrity                                  ║
║                                                                            ║
║ 8. CREATE INDEX "idx_tasks_batch" ON "tasks" ("batch_id");                ║
║    └─ Status: ✅ Improves query performance on batch operations           ║
║                                                                            ║
║ RESULT: ✅ Database schema now matches application expectations           ║
║         ✅ All foreign keys and indexes can be created                    ║
║         ✅ No data is deleted or lost                                     ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```
