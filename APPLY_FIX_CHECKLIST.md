# Fix Application Checklist ✅

Follow these steps to apply the database fix and complete your setup.

---

## 📋 Pre-Flight Check

- [ ] I understand the problem (read QUICK_FIX_SUMMARY.txt)
- [ ] I have access to Supabase Dashboard
- [ ] I know my project ID: `cuwdjemjuszaaxpouprc`
- [ ] I have read DATABASE_STATUS_REPORT.md
- [ ] Backup is not needed (we're only adding columns, no data loss)

---

## 🔧 Step 1: Access Supabase Dashboard

- [ ] Open browser to https://app.supabase.com/
- [ ] Sign in with your Supabase account
- [ ] Select project: **cuwdjemjuszaaxpouprc**
- [ ] From left sidebar, click: **SQL Editor**

```
Visual Guide:
┌─────────────────────────────────────────┐
│ Supabase Dashboard                      │
│ ┌───────────────────────────────────────┤
│ │ Projects                              │
│ │  └─ cuwdjemjuszaaxpouprc (✓ select)   │
│ │                                       │
│ │ Left Sidebar:                         │
│ │  ├─ Project Settings                 │
│ │  ├─ SQL Editor (✓ click here)        │
│ │  ├─ Tables                           │
│ │  └─ ...                              │
└─────────────────────────────────────────┘
```

---

## 📝 Step 2: Create New Query

- [ ] Click button: **"New Query"** or **"+"** (top of SQL Editor)
- [ ] Empty query area appears
- [ ] Ready to paste SQL

```
Visual Guide:
┌──────────────────────────────────────────┐
│ SQL Editor                               │
│ ┌────────────────────────────────────────┤
│ │ [New Query] [Recent] [Saved]          │
│ │ ┌──────────────────────────────────────┤
│ │ │ (empty text area - your SQL goes here)
│ │ │                                      │
│ │ │                                      │
│ │ │ [Run] [Format] [Save]  [⋮ More]    │
│ └──────────────────────────────────────┘
└──────────────────────────────────────────┘
```

---

## 📄 Step 3: Copy Fix Script

- [ ] Open file in IDE: `FIX_MIGRATION_0000_MEDICAL.sql`
- [ ] Select **ALL** content (Ctrl+A in that file)
- [ ] Copy (Ctrl+C)
- [ ] **Verify you copied everything** (file has ~25 lines)

```
File location: C:\Projects\scrimspec\FIX_MIGRATION_0000_MEDICAL.sql

Content preview:
Line 1:  -- ============================================================================
Line 2:  -- FIX: Apply missing columns to tasks table for 0000_medical migration
...
Last:    SELECT column_name, data_type, is_nullable ...
```

---

## 🔗 Step 4: Paste into SQL Editor

- [ ] Click in the SQL Editor text area
- [ ] Paste the content (Ctrl+V)
- [ ] Verify all SQL appeared:
  - Should see `ALTER TABLE "tasks"`
  - Should see `CREATE INDEX`
  - Should see `SELECT column_name` at bottom

```
Visual verification:
├─ Line 1-5:   ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS
├─ Line 6-9:   ALTER TABLE "tasks" ALTER COLUMN
├─ Line 10-11: CREATE INDEX IF NOT EXISTS
├─ Line 12+:   SELECT column_name... (verification query)
└─ Total lines: ~25-30 (should fill screen partially)
```

---

## ▶️ Step 5: Execute the Script

- [ ] Look for **"Run"** button (usually green, top-right)
- [ ] Click it or press **Ctrl+Enter**
- [ ] **WAIT** for execution to complete (5-10 seconds)
- [ ] Look at bottom of screen for results

```
Expected outputs:
1. First result: Empty (ALTER TABLE statements)
   Status: Success ✓

2. Second result: Empty (CREATE INDEX)
   Status: Success ✓

3. Third result: Table with columns
   ┌─────────────────┬──────────────┬─────────────┐
   │ column_name     │ data_type    │ is_nullable │
   ├─────────────────┼──────────────┼─────────────┤
   │ id              │ text         │ NO          │
   │ kind            │ text         │ NO          │
   │ status          │ text         │ NO          │
   │ prompt          │ text         │ YES         │
   │ params          │ jsonb        │ YES         │ ← NEW!
   │ file_id         │ text         │ YES         │ ← NEW!
   │ error           │ text         │ YES         │ ← NEW!
   │ batch_id        │ text         │ YES         │ ← NEW!
   │ topic           │ text         │ YES         │ ← NEW!
   │ lang            │ text         │ YES         │ ← NEW!
   │ ... (and more)  │              │             │
   └─────────────────┴──────────────┴─────────────┘
   Status: Success ✓
```

---

## ✅ Step 6: Verify the Fix

- [ ] Check the query results (last result set)
- [ ] Count the columns - should be **13 total**:
  - 7 original columns
  - 6 new columns
- [ ] Verify `batch_id` exists with type `text`
- [ ] Verify all new columns show `is_nullable: YES`

```
Checklist for results:
✓ params column exists (jsonb type)
✓ file_id column exists (text type)
✓ error column exists (text type)
✓ batch_id column exists (text type)
✓ topic column exists (text type)
✓ lang column exists (text type)
✓ All new columns have is_nullable = YES
✓ Total columns = 13
```

---

## 🎉 Step 7: Confirmation

- [ ] **No errors appeared** during execution
- [ ] Query results show all expected columns
- [ ] Verification query ran successfully
- [ ] **FIX IS COMPLETE!**

```
Success indicators:
✓ No red error messages
✓ "Success" or checkmark icon visible
✓ All 3 result sets completed
✓ Verification query returned 13 rows
```

---

## 📚 Optional: Review What Was Fixed

- [ ] Read: `DATABASE_STATUS_REPORT.md` (understand the details)
- [ ] Read: `SCHEMA_VISUALIZATION.md` (see the diagrams)
- [ ] Keep: `QUICK_FIX_SUMMARY.txt` (quick reference for team)

---

## 🚀 Next Steps After Fix

Once the fix is applied:

### Immediate (Now):
1. [ ] Database is ready for application use
2. [ ] All tables have correct schema
3. [ ] Indexes are properly created
4. [ ] No migration errors will occur

### Short-term (Before Next Development):
1. [ ] Test your application against the database
2. [ ] Verify data reads/writes work correctly
3. [ ] Check any existing data still loads properly

### Long-term (Future Development):
1. [ ] Consolidate setup strategy (migrations only, no mixed SQL)
2. [ ] Document database setup procedures
3. [ ] Plan backup/restore procedures
4. [ ] Consider environment-specific schemas

---

## 🆘 If Something Goes Wrong

### Error: "ERROR: permission denied for schema public"
- **Solution**: Verify you're logged into correct Supabase account
- **Solution**: Check project selection in dropdown

### Error: "column already exists"
- **This is OK!** It means fix was partially applied
- **Action**: Continue running script (other columns might still be missing)
- **Check**: Verify results in final SELECT query

### Error: "table tasks does not exist"
- **This should not happen** - but if it does:
- **Solution**: Run FINAL_SETUP.sql first
- **Solution**: Contact project lead for database status

### Error: "syntax error"
- **Cause**: SQL script may have been truncated during copy
- **Solution**: Delete everything in SQL editor, start over with Step 3
- **Solution**: Verify entire file was copied (check line count)

### No Results Shown
- **Solution**: Scroll down in results panel
- **Solution**: Wait 10 seconds for query to complete
- **Solution**: Check for error messages (red text)

---

## ✨ Success Criteria

Your fix is successful when:

```
✅ All ALTER TABLE statements execute without error
✅ CREATE INDEX statement executes without error
✅ SELECT verification query returns 13 rows
✅ New columns appear in results:
   - params (jsonb)
   - file_id (text)
   - error (text)
   - batch_id (text)
   - topic (text)
   - lang (text)
✅ No red error messages in interface
✅ "Success" indicator visible
✅ Database ready for application code
```

---

## 📞 Need Help?

- Check: `QUICK_FIX_SUMMARY.txt` (overview)
- Check: `DATABASE_STATUS_REPORT.md` (details)
- Check: `MIGRATION_FIX_INSTRUCTIONS.md` (alternatives)
- Check: `SCHEMA_VISUALIZATION.md` (diagrams)

All files are in project root directory.

---

**Last Updated**: 2024-10-24
**Project**: Scrimspec
**Database**: Supabase PostgreSQL
**Status**: Ready for fix application
