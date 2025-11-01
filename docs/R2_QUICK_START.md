# R2 Storage - Quick Start

## 🚀 Setup in 5 Minutes

### 1. Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Click **Create bucket**
3. Name it `scrimspec-assets`
4. Click **Create**

### 2. Create API Token

1. Click **Manage R2 API Tokens**
2. Click **Create API token**
3. Set permissions: **Object Read & Write**
4. Copy:
   - Access Key ID
   - Secret Access Key
   - Account ID (from R2 overview page)

### 3. Configure Environment

Add to `.env`:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=scrimspec-assets
```

### 4. Test It!

```bash
# Start the worker
pnpm --filter @scrimspec/workers dev:keyframe

# Start the dashboard
pnpm dev

# Generate keyframes (it will automatically use R2!)
```

## ✅ How to Verify It's Working

1. Create a project with keyframes
2. Check worker logs:
   ```
   ✅ "Uploading image to R2"
   ✅ "Image uploaded successfully to R2"
   ```
3. Check browser network tab:
   - Should see calls to `/api/r2/download-url`
   - Should see presigned R2 URLs being fetched

## 🔍 Troubleshooting

### Error: "Access Denied"
→ Check your API token has "Object Read & Write" permissions

### Error: "NoSuchBucket"
→ Verify `R2_BUCKET_NAME` matches your actual bucket name

### Images not loading
→ Check browser console for `/api/r2/download-url` errors

## 📚 Full Documentation

For complete details, see [R2 Setup Guide](./R2_SETUP_GUIDE.md)

---

**Cost:** ~$0.13/month for 1000 projects (vs. $9/month with AWS S3 egress fees)
