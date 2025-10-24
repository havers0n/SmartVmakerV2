# How to Fix the 0000_medical Migration Error

## Problem Summary

The `0000_medical_nicolaos.sql` migration cannot be applied because:

1. `FINAL_SETUP.sql` created the `tasks` table with incomplete schema
2. Migration expects 6 additional columns: `params`, `file_id`, `error`, `batch_id`, `topic`, `lang`
3. When migration tries to create index on `batch_id`, the column doesn't exist → **ERROR**

## Solution Steps

### Step 1: Prepare the Fix Script

The file `FIX_MIGRATION_0000_MEDICAL.sql` contains all necessary changes:
- Adds 6 missing columns to `tasks` table
- Updates NOT NULL constraints
- Creates the missing index

### Step 2: Execute in Supabase Dashboard

1. **Go to Supabase Dashboard**: https://app.supabase.com/
2. **Select your project**: `cuwdjemjuszaaxpouprc`
3. **Open SQL Editor**:
   - Click left sidebar → "SQL Editor"
   - Click "New Query"
4. **Copy SQL script**:
   - Open `FIX_MIGRATION_0000_MEDICAL.sql` from project root
   - Copy all content
5. **Paste and Run**:
   - Paste into SQL Editor
   - Click "Run" button (or Ctrl+Enter)
   - Wait for success message

### Step 3: Verify the Fix

The verification query at the bottom of the fix script will show all columns in `tasks` table:

Expected output should include these NEW columns:
```
 column_name  | data_type | is_nullable
--------------+-----------+------------
 params       | jsonb     | YES
 file_id      | text      | YES
 error        | text      | YES
 batch_id     | text      | YES
 topic        | text      | YES
 lang         | text      | YES
```

### Step 4: Try Migration Again (Optional)

Once fix is applied, you can try running the full `0000_medical_nicolaos.sql` migration:

1. In same SQL Editor, create new query
2. Copy content of `packages/db/migrations/0000_medical_nicolaos.sql`
3. Run it

It should succeed now because:
- All required columns will exist
- Index creation won't fail
- Foreign key constraints can be created properly

## Alternative: Complete Database Reset

If you want to start fresh and let migrations run cleanly:

### ⚠️ WARNING: This will DELETE all data!

```sql
-- Drop all dependent tables first
DROP TABLE IF EXISTS "clips" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.jobs" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.assets" CASCADE;
DROP TABLE IF EXISTS "generation_pipeline.shorts" CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS "assets" CASCADE;
DROP TABLE IF EXISTS "batches" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "video_analysis" CASCADE;
DROP TABLE IF EXISTS "analysis_queue" CASCADE;
DROP TABLE IF EXISTS "ingest_queue" CASCADE;
DROP TABLE IF EXISTS "youtube_videos" CASCADE;
DROP TABLE IF EXISTS "generation_events" CASCADE;

-- Now all migrations will create tables fresh
```

Then run all migration files in order:
1. `packages/db/migrations/0000_medical_nicolaos.sql`

## Files Reference

- **Fix Script**: `FIX_MIGRATION_0000_MEDICAL.sql` - Apply this first!
- **Original Setup**: `FINAL_SETUP.sql` - Already applied (created incomplete schema)
- **Migration**: `packages/db/migrations/0000_medical_nicolaos.sql` - Apply after fix
- **Schema Definitions**: `packages/db/src/schema/` - TypeScript definitions (source of truth)
- **Status Report**: `DATABASE_STATUS_REPORT.md` - Detailed analysis

## Troubleshooting

### If you get "column already exists"
- This is fine! Just skip that statement in the fix script
- The verification query will show if column exists

### If you get "permission denied"
- Check Supabase project is selected
- Verify you're using dashboard (not CLI with wrong token)
- Check access token hasn't expired

### If index creation fails
- The column might exist but with wrong type
- Check output of verification query
- May need to drop and recreate column with correct type

## Architecture Note

For future development:
- **Use migrations exclusively** OR **direct SQL setup files**, but not both
- Current mixed approach creates confusion
- Recommend: Use Drizzle migrations + schema files only
- Remove manual FINAL_SETUP.sql once everything is migrated

## Timeline

- ✅ `FINAL_SETUP.sql` applied - created base tables (but incomplete)
- ⏳ `FIX_MIGRATION_0000_MEDICAL.sql` - needs to be applied manually
- ⏳ `0000_medical_nicolaos.sql` - apply after fix is complete
- Future: Use migrations only for schema management
