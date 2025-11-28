# ☁️ Cloudflare R2 Storage Integration

> S3-compatible object storage with zero egress fees for Scrimspec keyframe generation

## 🎯 What is This?

We've integrated **Cloudflare R2** as the storage backend for AI-generated keyframe images. R2 is an S3-compatible object storage service that eliminates expensive egress (bandwidth) fees while providing global CDN performance.

## ✨ Key Benefits

| Feature | R2 | AWS S3 | Supabase Storage |
|---------|----|---------| -----------------|
| **Storage Cost** | $0.015/GB | $0.023/GB | $0.021/GB |
| **Egress Cost** | **$0** 🎉 | $0.09/GB | $0.09/GB |
| **API Operations** | $0.36/1M reads | $0.40/1M reads | Included |
| **Global CDN** | ✅ Built-in | ❌ Extra cost | ✅ Built-in |
| **S3 Compatible** | ✅ Yes | ✅ Yes | ❌ No |

**Monthly Cost Example (1000 projects, 8 images each):**
- **R2:** ~$0.13/month
- **AWS S3:** ~$9/month (with egress)
- **Savings:** 98% 🚀

## 🚀 Quick Start

### 1. Setup R2 (5 minutes)

```bash
# 1. Create R2 bucket in Cloudflare Dashboard
#    → https://dash.cloudflare.com/ → R2 → Create bucket
#    → Name: scrimspec-assets

# 2. Create API token
#    → Manage R2 API Tokens → Create API token
#    → Permissions: Object Read & Write
#    → Copy: Access Key ID, Secret Access Key, Account ID

# 3. Add to .env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=scrimspec-assets
```

### 2. Test It

```bash
# Build packages
pnpm install
pnpm --filter @aec/storage-client build

# Start worker
pnpm --filter @scrimspec/workers dev:keyframe

# Start dashboard
pnpm dev

# Generate keyframes - they'll automatically use R2!
```

## 📚 Documentation

| Document | Description | Time to Read |
|----------|-------------|--------------|
| **[Quick Start](./docs/R2_QUICK_START.md)** | 5-minute setup guide | 3 min |
| **[Complete Setup](./docs/R2_SETUP_GUIDE.md)** | Full configuration & troubleshooting | 15 min |
| **[Migration Summary](./docs/R2_MIGRATION_SUMMARY.md)** | What changed & why | 10 min |

## 🏗️ Architecture

### How It Works

```
┌──────────────────────────────────────────────────────────┐
│ 1. Keyframe Worker (Server)                              │
│    - Gemini generates image                               │
│    - uploadLargeStream() uploads to R2                    │
│    - Stores R2 key in database                            │
│    - Key: "keyframes/project-id/scene-0-first.png"        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Cloudflare R2 (Storage)                               │
│    - Receives multipart upload                            │
│    - Stores on global CDN                                 │
│    - NO egress fees 🎉                                    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 3. UI Component (Client)                                 │
│    - Reads R2 key from database                           │
│    - useR2DownloadUrl() fetches presigned URL             │
│    - Displays image with temporary URL                    │
│    - URL expires after 1 hour (security)                  │
└──────────────────────────────────────────────────────────┘
```

### Storage Structure

```
scrimspec-assets/
  keyframes/
    <project-uuid>/
      scene-0-first-1705234567890.png    (500KB)
      scene-0-last-1705234578901.png     (500KB)
      scene-1-first-1705234589012.png    (500KB)
      scene-1-last-1705234600123.png     (500KB)
      ...
```

## 🔧 Technical Details

### New Package: `@aec/storage-client`

A lightweight wrapper around AWS S3 SDK for R2 operations:

```typescript
import {
  r2,                   // S3 client instance
  R2_BUCKET,            // Bucket name
  uploadLargeStream,    // Upload with multipart
  createDownloadUrl,    // Get presigned URL
  createUploadUrl       // Get presigned upload URL
} from '@aec/storage-client';
```

### API Endpoints

**POST /api/r2/upload-url**
```json
Request:  { "key": "keyframes/...", "contentType": "image/png" }
Response: { "uploadUrl": "https://...", "expiresAt": "..." }
```

**POST /api/r2/download-url**
```json
Request:  { "key": "keyframes/..." }
Response: { "downloadUrl": "https://...", "expiresAt": "..." }
```

### UI Components

**R2Image Component:**
```tsx
import { R2Image } from '@/shared/components/ui/r2-image';

<R2Image
  r2Key="keyframes/project-id/scene-0-first.png"
  alt="Scene 1 - Opening"
  className="w-full h-full object-cover"
/>
```

**useR2DownloadUrl Hook:**
```tsx
import { useR2DownloadUrl } from '@/shared/hooks/use-r2-url';

const { data: imageUrl, isLoading } = useR2DownloadUrl(r2Key);
```

## 🔐 Security

### Presigned URLs
- Generated server-side only
- Expire after 1 hour
- No credentials exposed to client
- Temporary access to specific objects

### API Token Permissions
- Scoped to specific bucket
- Object Read & Write only
- No admin permissions needed
- Can be rotated anytime

### Key Validation
- Server-side validation
- Prevents path traversal
- Sanitizes user input
- Audit logging

## 💰 Cost Breakdown

### Per Project (8 images, 500KB each)

**Storage:**
- Size: 4MB
- Cost: 4MB × $0.015/GB = $0.00006/month

**Operations:**
- Writes: 8 uploads = $0.000036
- Reads: 8 downloads × 10 views = $0.0000288

**Total per project:** ~$0.0001/month

### At Scale (1000 projects)

**Storage:** ~$0.06/month
**Operations:** ~$0.065/month
**Total:** ~$0.13/month

**Compare to AWS S3 with egress:**
- 100GB transferred × $0.09/GB = $9/month
- **R2 savings: 98%** 🎉

## 🧪 Testing

### Verify R2 Integration

```bash
# 1. Check worker uploads to R2
pnpm --filter @scrimspec/workers dev:keyframe
# Look for: "Uploading image to R2"

# 2. Create a project with keyframes
# Navigate to: http://localhost:3000/hwar/create/new

# 3. Check browser network tab
# Should see: /api/r2/download-url requests

# 4. Verify R2 bucket
# Cloudflare Dashboard → R2 → scrimspec-assets
# Should see: keyframes/<project-id>/ folders
```

### Test Presigned URLs

```bash
# Test download URL generation
curl -X POST http://localhost:3000/api/r2/download-url \
  -H "Content-Type: application/json" \
  -d '{"key": "keyframes/test/image.png"}'

# Expected response:
{
  "downloadUrl": "https://...r2.cloudflarestorage.com/...",
  "key": "keyframes/test/image.png",
  "expiresAt": "2025-01-12T10:30:00.000Z"
}
```

## 🐛 Troubleshooting

### Worker can't upload to R2

**Error:** "Access Denied"
- ✅ Check `R2_ACCESS_KEY_ID` is correct
- ✅ Verify API token has "Object Read & Write" permission
- ✅ Ensure token is scoped to correct bucket

**Error:** "NoSuchBucket"
- ✅ Verify `R2_BUCKET_NAME` matches actual bucket name
- ✅ Check bucket exists in Cloudflare Dashboard

### UI images not loading

**Check:**
1. Browser console for `/api/r2/download-url` errors
2. R2 key is stored in database (not full URL)
3. Environment variables are set in `.env`
4. Dashboard server has access to R2 credentials

**Debug:**
```bash
# Check if R2 key is being fetched
# Browser DevTools → Network → Filter: download-url

# Check database
SELECT id, storage_url, status
FROM generation_pipeline.assets
WHERE asset_type = 'keyframe'
LIMIT 5;
```

## 📦 Package Structure

```
packages/
  storage-client/          # NEW: R2 client package
    src/
      index.ts             # R2 client & functions
    package.json
    tsconfig.json

apps/dashboard/
  src/app/api/r2/          # NEW: R2 API endpoints
    upload-url/route.ts
    download-url/route.ts
  shared/
    components/ui/
      r2-image.tsx         # NEW: R2 image component
    hooks/
      use-r2-url.ts        # NEW: R2 URL hooks

packages/workers/
  src/
    keyframe-worker.ts     # MODIFIED: Now uses R2
```

## 🔄 Migration from Supabase

**Good news:** No migration needed!

- ✅ Old keyframes (Supabase URLs) continue working
- ✅ New keyframes automatically use R2
- ✅ Gradual transition as new keyframes are generated
- ✅ No data loss or downtime

## 📞 Support

### Common Issues
- [R2 Setup Guide](./docs/R2_SETUP_GUIDE.md#troubleshooting)
- [Migration Summary](./docs/R2_MIGRATION_SUMMARY.md)

### Resources
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [AWS S3 SDK Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/)
- [Pricing Calculator](https://r2-calculator.cloudflare.com/)

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** January 2025
**Package:** @aec/storage-client

**Get Started:** [R2 Quick Start](./docs/R2_QUICK_START.md) → 5 minutes ⚡
