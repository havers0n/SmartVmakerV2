import { NextRequest, NextResponse } from 'next/server';
import { createUploadUrl } from '@aec/storage-client';
import { createLogger } from '@aec/logger';

export const runtime = 'nodejs';

const logger = createLogger({ name: 'api-r2-upload-url' });

/**
 * POST /api/r2/upload-url
 *
 * Generate a presigned URL for uploading a file to Cloudflare R2
 *
 * Request body:
 * {
 *   key: string,           // Object key (path) in R2, e.g., "projects/abc123/image.png"
 *   contentType: string,   // MIME type, e.g., "image/png"
 *   expiresIn?: number     // Optional: URL expiration in seconds (default: 3600)
 * }
 *
 * Response:
 * {
 *   uploadUrl: string,     // Presigned URL for PUT request
 *   key: string,           // Echo back the object key
 *   expiresAt: string      // ISO timestamp when URL expires
 * }
 *
 * Usage:
 * 1. Client requests presigned URL from this endpoint
 * 2. Client uploads file directly to R2 using the presigned URL (PUT request)
 * 3. Client confirms upload completion and saves the key to database
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, contentType, expiresIn = 3600 } = body;

    // Validate required fields
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "key" field' },
        { status: 400 }
      );
    }

    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "contentType" field' },
        { status: 400 }
      );
    }

    // Validate key format (basic sanitization)
    if (key.includes('..') || key.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid key format. Key should not contain ".." or start with "/"' },
        { status: 400 }
      );
    }

    logger.info({ key, contentType, expiresIn }, 'Generating upload URL');

    // Generate presigned upload URL
    const uploadUrl = await createUploadUrl(key, contentType, expiresIn);

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    logger.info({ key }, 'Upload URL generated successfully');

    return NextResponse.json(
      {
        uploadUrl,
        key,
        expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to generate upload URL');

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
