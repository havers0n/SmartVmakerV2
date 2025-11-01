# Cloudflare R2 Storage - Setup Guide

## Overview

This guide will help you set up Cloudflare R2 storage for the Scrimspec keyframe generation feature. R2 is Cloudflare's S3-compatible object storage solution with zero egress fees.

## Why R2?

- **No Egress Fees:** Unlike AWS S3, R2 doesn't charge for bandwidth when serving files
- **S3-Compatible:** Works with standard AWS S3 SDKs
- **Global CDN:** Built on Cloudflare's network for fast delivery
- **Cost-Effective:** ~$0.015/GB storage, $0.00036/10k reads, $0.0045/10k writes

## Prerequisites

- Cloudflare account (free tier available)
- Cloudflare Workers paid plan ($5/month minimum for R2 access)

## Step-by-Step Setup

### 1. Create an R2 Bucket

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click **Create bucket**
4. Configure your bucket:
   - **Bucket name:** `scrimspec-assets` (or your preferred name)
   - **Location:** Choose a location closest to your users
5. Click **Create bucket**

### 2. Create R2 API Tokens

1. In the R2 dashboard, go to **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure the token:
   - **Token name:** `scrimspec-r2-access`
   - **Permissions:**
     - ✅ Object Read & Write
     - ✅ Admin Read & Write (if you need bucket management)
   - **TTL:** No expiry (or set as needed)
   - **Bucket scope:** Select your `scrimspec-assets` bucket
4. Click **Create API Token**
5. **IMPORTANT:** Copy these values immediately (they won't be shown again):
   - Access Key ID
   - Secret Access Key
   - R2 Account ID (from the R2 overview page)

### 3. Configure Environment Variables

Add these variables to your `.env` file in the project root:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=scrimspec-assets

# Optional: Custom domain for public access (see step 4)
R2_PUBLIC_DOMAIN=assets.yourdomain.com
```

**Where to find these values:**
- **R2_ACCOUNT_ID:** Cloudflare Dashboard → R2 → Overview (top right)
- **R2_ACCESS_KEY_ID:** From the API token you just created
- **R2_SECRET_ACCESS_KEY:** From the API token you just created
- **R2_BUCKET_NAME:** The bucket name you chose in step 1

### 4. (Optional) Set Up Custom Domain

For public access to files, you need to configure a custom domain:

1. In your R2 bucket settings, go to **Settings** → **Public access**
2. Click **Connect domain**
3. Choose a subdomain (e.g., `assets.yourdomain.com`)
4. Cloudflare will automatically:
   - Create a CNAME record
   - Issue an SSL certificate
   - Enable public access via the custom domain

5. Update your `.env`:
```bash
R2_PUBLIC_DOMAIN=assets.yourdomain.com
```

**Note:** Without a custom domain, you'll use presigned URLs for all access (which is fine for our use case).

### 5. Verify Configuration

Test your R2 setup with a quick Node.js script:

```bash
# Build the storage-client package
pnpm --filter @aec/storage-client build

# Test R2 connection
node -e "
const { r2, R2_BUCKET } = require('./packages/storage-client/dist/index.js');
console.log('R2 Bucket:', R2_BUCKET);
console.log('R2 Client configured successfully!');
"
```

If you see the bucket name without errors, you're all set!

## Architecture Overview

### How R2 Integration Works

```
┌─────────────────────────────────────────────────────────────┐
│  Keyframe Worker                                             │
│  - Generates image with Gemini                               │
│  - Uploads to R2 using uploadLargeStream()                   │
│  - Stores R2 key in database (not full URL)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare R2 Storage                                       │
│  Bucket: scrimspec-assets                                    │
│  Key: keyframes/project-id/scene-0-first-timestamp.png       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  UI Component (R2Image)                                      │
│  - Reads R2 key from database                                │
│  - Calls /api/r2/download-url to get presigned URL          │
│  - Displays image using temporary URL                        │
│  - URL expires after 1 hour (security)                       │
└─────────────────────────────────────────────────────────────┘
```

### Storage Structure

```
scrimspec-assets/
  keyframes/
    <project-id>/
      scene-0-first-1705234567890.png
      scene-0-last-1705234578901.png
      scene-1-first-1705234589012.png
      scene-1-last-1705234600123.png
      ...
```

## API Endpoints

### POST /api/r2/upload-url

Generate a presigned URL for uploading a file.

**Request:**
```json
{
  "key": "keyframes/project-id/image.png",
  "contentType": "image/png",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "uploadUrl": "https://...presigned-url...",
  "key": "keyframes/project-id/image.png",
  "expiresAt": "2025-01-12T10:30:00.000Z"
}
```

**Usage:**
```javascript
// 1. Get presigned URL
const { uploadUrl } = await fetch('/api/r2/upload-url', {
  method: 'POST',
  body: JSON.stringify({ key, contentType: 'image/png' })
}).then(r => r.json());

// 2. Upload file directly to R2
await fetch(uploadUrl, {
  method: 'PUT',
  body: imageBlob,
  headers: { 'Content-Type': 'image/png' }
});
```

### POST /api/r2/download-url

Generate a presigned URL for downloading a file.

**Request:**
```json
{
  "key": "keyframes/project-id/image.png",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "downloadUrl": "https://...presigned-url...",
  "key": "keyframes/project-id/image.png",
  "expiresAt": "2025-01-12T10:30:00.000Z"
}
```

## Usage in Code

### Worker (Server-side Upload)

```typescript
import { uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import { Readable } from 'stream';

// Generate R2 key
const key = `keyframes/${projectId}/scene-${sceneIndex}-${frameType}.png`;

// Convert buffer to stream
const stream = Readable.from(imageBuffer);

// Upload to R2
await uploadLargeStream(key, stream, 'image/png');

// Save key to database
await db.update(assets).set({ storageUrl: key });
```

### UI (Client-side Display)

```typescript
import { R2Image } from '@/shared/components/ui/r2-image';

// The component automatically fetches presigned URLs
<R2Image
  r2Key={asset.storageUrl}
  alt="Scene 1 - Opening Frame"
  className="w-full h-full object-cover"
/>
```

### Custom Hook

```typescript
import { useR2DownloadUrl } from '@/shared/hooks/use-r2-url';

const { data: imageUrl, isLoading } = useR2DownloadUrl(r2Key);

return (
  <div>
    {isLoading && <Spinner />}
    {imageUrl && <img src={imageUrl} alt="Image" />}
  </div>
);
```

## Security Best Practices

1. **Never expose R2 credentials client-side**
   - All R2 operations are server-side
   - UI uses presigned URLs with expiration

2. **Use presigned URLs with short expiration**
   - Default: 1 hour
   - Prevents unauthorized long-term access

3. **Validate keys server-side**
   - Prevent path traversal attacks (`..`)
   - Sanitize user input

4. **Use HTTPS only**
   - Presigned URLs use HTTPS by default
   - Never transmit credentials over HTTP

## Cost Estimation

### Storage Costs
- **Images:** ~500KB per image (PNG)
- **Project:** 8 images = ~4MB
- **Cost:** 4MB × $0.015/GB = $0.00006 per project
- **1000 projects:** ~$0.06/month storage

### Operation Costs
- **Writes:** 8 uploads = $0.000036
- **Reads:** 8 downloads × 10 views = 80 reads = $0.0000288
- **Total per project:** ~$0.000065
- **1000 projects:** ~$0.065/month operations

### Total Monthly Cost (1000 projects)
- **Storage:** $0.06
- **Operations:** $0.065
- **Total:** ~$0.13/month

**Compare to AWS S3:**
- S3 would charge ~$9/month for egress (100GB @ $0.09/GB)
- R2 egress is FREE

## Troubleshooting

### Error: "Access Denied"

**Cause:** Invalid credentials or permissions

**Fix:**
1. Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY
2. Check token permissions include "Object Read & Write"
3. Ensure token is scoped to the correct bucket

### Error: "NoSuchBucket"

**Cause:** Bucket doesn't exist or wrong name

**Fix:**
1. Verify R2_BUCKET_NAME matches your actual bucket
2. Check bucket exists in Cloudflare Dashboard

### Error: "SignatureDoesNotMatch"

**Cause:** Clock skew or incorrect secret key

**Fix:**
1. Verify system clock is correct
2. Double-check R2_SECRET_ACCESS_KEY (no extra spaces)
3. Regenerate API token if needed

### Images not loading in UI

**Cause:** Presigned URL expiration or fetch error

**Fix:**
1. Check browser console for errors
2. Verify /api/r2/download-url endpoint is working
3. Test presigned URL directly in browser
4. Check useR2DownloadUrl hook is enabled

## Migration from Supabase Storage

If you're migrating from Supabase Storage to R2:

1. **Keep existing images:**
   - No need to migrate existing Supabase images
   - New keyframes will use R2

2. **Update database:**
   - `storageUrl` field now contains R2 keys, not URLs
   - UI components handle both formats

3. **Gradual rollout:**
   - Old projects: Supabase URLs (still work)
   - New projects: R2 keys (use presigned URLs)

## Support & Resources

- **Cloudflare R2 Docs:** https://developers.cloudflare.com/r2/
- **AWS S3 SDK Docs:** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/
- **Pricing Calculator:** https://r2-calculator.cloudflare.com/

---

**Status:** ✅ Ready for Use
**Last Updated:** January 2025
**Package:** @aec/storage-client v0.1.0
