# R2 Storage Integration - Migration Summary

## ✅ What Was Changed

### 1. New Package: `@aec/storage-client`

Created a new workspace package for R2 storage operations:

**Location:** `packages/storage-client/`

**Exports:**
- `r2` - S3 client instance configured for Cloudflare R2
- `R2_BUCKET` - Bucket name constant
- `createUploadUrl()` - Generate presigned upload URLs
- `createDownloadUrl()` - Generate presigned download URLs
- `uploadLargeStream()` - Upload large files/streams with multipart support
- `uploadBuffer()` - Upload small buffers directly

### 2. API Endpoints

**Created:**
- `POST /api/r2/upload-url` - Generate presigned upload URLs
- `POST /api/r2/download-url` - Generate presigned download URLs

**Location:** `apps/dashboard/src/app/api/r2/`

### 3. Worker Modifications

**File:** `packages/workers/src/keyframe-worker.ts`

**Changes:**
- Removed Supabase Storage dependency
- Added R2 storage client import
- Modified `uploadImageToStorage()` → `uploadImageToR2()`
- Now stores R2 keys instead of full URLs in database
- Uses `uploadLargeStream()` for efficient multipart uploads

**Before:**
```typescript
// Uploaded to Supabase, stored full URL
const storageUrl = await uploadImageToStorage(...);
// storageUrl: "https://supabase.../keyframes/project-id/image.png"
```

**After:**
```typescript
// Uploads to R2, stores key only
const r2Key = await uploadImageToR2(...);
// r2Key: "keyframes/project-id/scene-0-first-1234.png"
```

### 4. UI Components

**New Components:**
- `R2Image` - Automatically fetches presigned URLs and displays images
- `useR2DownloadUrl()` - React hook for fetching presigned URLs
- `useR2UploadUrl()` - React hook for uploading files

**Location:**
- `apps/dashboard/src/shared/components/ui/r2-image.tsx`
- `apps/dashboard/src/shared/hooks/use-r2-url.ts`

**Modified:**
- `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`
  - Now uses `<R2Image>` component instead of direct `<img>` tags
  - Automatically fetches presigned URLs in the background

### 5. Database Schema

**No changes required!**
- `assets.storageUrl` field remains the same
- Now contains R2 keys instead of full URLs
- Backward compatible with existing Supabase URLs

## 🔄 How It Works Now

### Upload Flow (Worker)

```
1. Gemini generates image → Buffer
2. Buffer → Readable stream
3. uploadLargeStream(key, stream, contentType)
4. R2 stores image
5. Database stores key: "keyframes/project-id/scene-0-first.png"
```

### Download Flow (UI)

```
1. UI reads R2 key from database
2. useR2DownloadUrl(key) hook fetches presigned URL
3. URL cached for 50 minutes
4. <R2Image> displays image using presigned URL
5. URL expires after 1 hour (security)
```

## 📊 Key Benefits

### Cost Savings
- **Before (Supabase):** Storage + egress fees
- **After (R2):** Storage only, $0 egress
- **Savings:** ~$9/month per 100GB transferred

### Performance
- Built on Cloudflare's global CDN
- Lower latency worldwide
- Automatic caching

### Security
- Presigned URLs expire after 1 hour
- No public bucket access needed
- Credentials never exposed client-side

### Scalability
- Multipart uploads for large files
- Automatic retry logic
- No concurrent upload limits

## 🔧 Environment Variables

**Required (new):**
```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=scrimspec-assets
```

**Optional:**
```bash
R2_PUBLIC_DOMAIN=assets.yourdomain.com  # For public URLs
```

**Deprecated (can remove):**
```bash
# These are no longer used for keyframes
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
```

## 🎯 Migration Steps for Existing Projects

### For New Deployments
1. Follow [R2 Quick Start](./R2_QUICK_START.md)
2. Set environment variables
3. Deploy - that's it!

### For Existing Projects
1. Old keyframes (Supabase URLs) will continue working
2. New keyframes will use R2 automatically
3. No data migration needed
4. Gradual transition as new keyframes are generated

## 📦 Package Dependencies

**Added:**
- `@aws-sdk/client-s3@^3.504.0`
- `@aws-sdk/s3-request-presigner@^3.504.0`
- `@aws-sdk/lib-storage@^3.504.0`

**Updated packages:**
- `packages/workers` - Added `@aec/storage-client` dependency
- `apps/dashboard` - Added `@aec/storage-client` dependency

## 🧪 Testing Checklist

- [x] R2 client can connect to bucket
- [x] Worker can upload images to R2
- [x] Worker stores R2 keys in database
- [x] UI can fetch presigned URLs
- [x] UI can display images from R2
- [x] Presigned URLs expire correctly
- [x] Error handling works
- [x] Loading states display properly

## 📁 Files Created

```
packages/
  storage-client/
    src/index.ts                    # R2 client implementation
    package.json
    tsconfig.json

apps/dashboard/src/
  app/api/r2/
    upload-url/route.ts             # Presigned upload URL endpoint
    download-url/route.ts           # Presigned download URL endpoint
  shared/
    components/ui/r2-image.tsx      # R2 image component
    hooks/use-r2-url.ts             # R2 URL hooks

docs/
  R2_SETUP_GUIDE.md                 # Complete setup guide
  R2_QUICK_START.md                 # 5-minute quick start
  R2_MIGRATION_SUMMARY.md           # This file
```

## 📁 Files Modified

```
packages/workers/
  src/keyframe-worker.ts            # Now uses R2 instead of Supabase
  package.json                      # Added storage-client dependency

apps/dashboard/
  src/app/hwar/create/[project_id]/page.tsx  # Uses R2Image component
  package.json                      # Added storage-client dependency
```

## 🔗 Related Documentation

- [R2 Setup Guide](./R2_SETUP_GUIDE.md) - Complete setup instructions
- [R2 Quick Start](./R2_QUICK_START.md) - 5-minute setup
- [Keyframe Generation Guide](./KEYFRAME_GENERATION_GUIDE.md) - Full feature docs

---

**Migration Date:** January 2025
**Status:** ✅ Complete
**Backward Compatibility:** Yes (existing Supabase URLs still work)
