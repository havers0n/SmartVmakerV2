import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

/**
 * Cloudflare R2 Storage Client
 *
 * This module provides a simple interface for interacting with Cloudflare R2
 * using the AWS S3 SDK. R2 is S3-compatible, so we use the standard S3 client.
 */

// ============================================================================
// Configuration
// ============================================================================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET = process.env.R2_BUCKET_NAME || "scrimspec-assets";

// Validate required environment variables
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn(
    "⚠️  R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.",
  );
}

// ============================================================================
// R2 Client Instance
// ============================================================================

/**
 * S3 Client configured for Cloudflare R2
 */
export const r2 = new S3Client({
  region: "auto", // R2 uses 'auto' for region
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

// ============================================================================
// Presigned URL Functions
// ============================================================================

/**
 * Create a presigned URL for uploading a file to R2
 *
 * @param key - The object key (path) in R2
 * @param contentType - MIME type of the file being uploaded
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned upload URL
 *
 * @example
 * const uploadUrl = await createUploadUrl('projects/abc123/image.png', 'image/png');
 * // Client can now PUT to this URL
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(r2, command, { expiresIn });
  return url;
}

/**
 * Create a presigned URL for downloading a file from R2
 *
 * @param key - The object key (path) in R2
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned download URL
 *
 * @example
 * const downloadUrl = await createDownloadUrl('projects/abc123/image.png');
 * // Client can now GET from this URL
 */
export async function createDownloadUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(r2, command, { expiresIn });
  return url;
}

// ============================================================================
// Upload Functions
// ============================================================================

/**
 * Upload a large file or stream to R2 using multipart upload
 *
 * This function is optimized for large files and streams. It automatically
 * handles multipart uploads for files larger than the part size.
 *
 * @param key - The object key (path) in R2
 * @param stream - Readable stream or Buffer containing the file data
 * @param contentType - MIME type of the file
 * @returns Object containing the uploaded file's key and bucket
 *
 * @example
 * // Upload from a buffer
 * const imageBuffer = Buffer.from(base64Data, 'base64');
 * const stream = Readable.from(imageBuffer);
 * await uploadLargeStream('projects/abc123/image.png', stream, 'image/png');
 *
 * @example
 * // Upload from a file stream
 * const fileStream = fs.createReadStream('./video.mp4');
 * await uploadLargeStream('videos/abc123/output.mp4', fileStream, 'video/mp4');
 */
export async function uploadLargeStream(
  key: string,
  stream: Readable | Buffer,
  contentType: string,
): Promise<{ key: string; bucket: string }> {
  // Convert Buffer to Readable stream if needed
  const readableStream = Buffer.isBuffer(stream)
    ? Readable.from(stream)
    : stream;

  const upload = new Upload({
    client: r2,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: readableStream,
      ContentType: contentType,
    },
    // Multipart upload configuration
    queueSize: 4, // Number of concurrent parts to upload
    partSize: 5 * 1024 * 1024, // 5MB per part (minimum for S3/R2)
    leavePartsOnError: false, // Clean up failed uploads
  });

  // Execute upload with progress tracking
  upload.on("httpUploadProgress", (progress) => {
    if (progress.loaded && progress.total) {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      console.log(`Upload progress for ${key}: ${percent}%`);
    }
  });

  await upload.done();

  return {
    key,
    bucket: R2_BUCKET,
  };
}

/**
 * Delete an object from R2 by key
 *
 * @param key - The object key (path) in R2
 * @returns void
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  await r2.send(command);
}

/**
 * Upload a buffer directly to R2 (for smaller files)
 *
 * @param key - The object key (path) in R2
 * @param buffer - Buffer containing the file data
 * @param contentType - MIME type of the file
 * @returns Object containing the uploaded file's key and bucket
 */
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ key: string; bucket: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2.send(command);

  return {
    key,
    bucket: R2_BUCKET,
  };
}

// ============================================================================
// URL Helper Functions
// ============================================================================

/**
 * Get the public URL for an R2 object (if bucket has public access)
 * Note: By default, R2 buckets are private. You need to configure
 * a custom domain or public access policy.
 *
 * @param key - The object key (path) in R2
 * @returns Public URL (if configured)
 */
export function getPublicUrl(key: string): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (!publicDomain) {
    throw new Error(
      "R2_PUBLIC_DOMAIN not configured. Set up a custom domain in Cloudflare R2 settings.",
    );
  }

  return `https://${publicDomain}/${key}`;
}

/**
 * Parse an R2 key from a full URL or path
 *
 * @param urlOrPath - Full URL or object key
 * @returns The object key
 */
export function parseR2Key(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\//, ""); // Remove leading slash
  } catch {
    // Not a URL, assume it's already a key
    return urlOrPath;
  }
}
