# Keyframe Generation - Quick Start

## 🚀 Quick Start (5 minutes)

### 1. Setup (One-time)

```bash
# Create the Supabase storage bucket
pnpm --filter @scrimspec/db storage:setup

# Verify your .env has these variables:
# GEMINI_API_KEY=...
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Start the Worker

```bash
# Terminal 1: Start the keyframe worker
pnpm --filter @scrimspec/workers dev:keyframe
```

### 3. Start the Dashboard

```bash
# Terminal 2: Start the dashboard
pnpm dev
```

### 4. Test the Feature

1. **Navigate to:** http://localhost:3000/hwar/create/new
2. **Create a project:**
   - Title: "Test Project"
   - Ratio: "9:16"
   - Source: "Prompt"
   - Prompt: "A cute puppy learning to skateboard"
3. **Generate scenarios** → Wait for 3 scenarios to appear
4. **Select a scenario** → Click on one
5. **Generate keyframes** → Click "Generate Keyframes" button
6. **Watch progress** → Page auto-refreshes, images appear in ~1-2 minutes

## ✅ Expected Output

You should see:
- ✅ Progress badge: "Generating 0/8" → "Generating 8/8" → "Complete"
- ✅ For each scene:
  - Opening frame (photorealistic image)
  - Closing frame (photorealistic image)
- ✅ Images matching your selected aspect ratio

## 🐛 Troubleshooting

### No images appearing?

**Check worker logs:**
```bash
# Look for:
# ✅ "Worker generates keyframes using Gemini 2.5 Flash Image"
# ✅ "Processing keyframe job"
# ✅ "Image uploaded successfully"
# ✅ "Keyframe job completed successfully"
```

### Worker errors?

**Common fixes:**
- Missing GEMINI_API_KEY → Add to `.env`
- Bucket not found → Run `pnpm --filter @scrimspec/db storage:setup`
- Database connection → Check DRIZZLE_DATABASE_URL

### UI not updating?

**Check browser console:**
- Should auto-refresh every 3-5 seconds
- Look for API fetch errors

## 📊 Monitoring

### Check job queue:

```sql
SELECT status, COUNT(*)
FROM jobs.keyframe_job_queue
GROUP BY status;
```

### Check assets:

```sql
SELECT status, asset_type, COUNT(*)
FROM generation_pipeline.assets
GROUP BY status, asset_type;
```

## 💡 Tips

- **Aspect Ratio:** Use 9:16 for vertical videos (Shorts/Reels)
- **Prompts:** Be specific about characters, settings, actions
- **Cost:** ~$0.01 per image, 8 images per typical project = ~$0.08
- **Speed:** ~5-10 seconds per image with Gemini 2.5 Flash

## 📚 Full Documentation

See [KEYFRAME_GENERATION_GUIDE.md](./KEYFRAME_GENERATION_GUIDE.md) for complete details.
