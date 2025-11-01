import { NextRequest, NextResponse } from 'next/server';
import { createDownloadUrl } from '@aec/storage-client';
import { createLogger } from '@aec/logger';

export const runtime = 'nodejs';

const logger = createLogger({ name: 'api-r2-download-url' });

/**
 * POST /api/r2/download-url
 *
 * Generate a presigned URL for downloading a file from Cloudflare R2
 *
 * Request body:
 * {
 *   key: string,           // Object key (path) in R2, e.g., "projects/abc123/image.png"
 *   expiresIn?: number     // Optional: URL expiration in seconds (default: 3600)
 * }
 *
 * Response:
 * {
 *   downloadUrl: string,   // Presigned URL for GET request
 *   key: string,           // Echo back the object key
 *   expiresAt: string      // ISO timestamp when URL expires
 * }
 *
 * Usage:
 * 1. Client requests presigned URL from this endpoint with the object key
 * 2. Client downloads file directly from R2 using the presigned URL (GET request)
 * 3. URL expires after the specified time for security
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, expiresIn = 3600 } = body;

    // Validate required fields
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "key" field' },
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

    logger.info({ key, expiresIn }, 'Generating download URL');

    // Generate presigned download URL
    const downloadUrl = await createDownloadUrl(key, expiresIn);

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    logger.info({ key }, 'Download URL generated successfully');

    return NextResponse.json(
      {
        downloadUrl,
        key,
        expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to generate download URL');

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
