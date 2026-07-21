import { NextRequest, NextResponse } from 'next/server';
import { createUploadUrl } from '@aec/storage-client';
import { createLogger } from '@aec/logger';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { generationProjects } from '@/shared/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

const logger = createLogger({ name: 'api-r2-upload-url' });

const UploadUrlRequestSchema = z.object({
  key: z.string().min(3).max(1024),
  contentType: z.string().min(1).max(255),
  expiresIn: z.number().int().min(60).max(3600).optional(),
});

async function canAccessKey(key: string, userId: string): Promise<boolean> {
  if (key.includes('..') || key.startsWith('/')) return false;

  const parts = key.split('/').filter(Boolean);
  if (parts.length < 3) return false;

  if (parts[0] === 'users') {
    return parts[1] === userId;
  }

  if (parts[0] === 'projects') {
    const projectId = parts[1];
    const [project] = await db
      .select({ id: generationProjects.id })
      .from(generationProjects)
      .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)))
      .limit(1);
    return !!project;
  }

  return false;
}

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
    const userId = getTrustedUserId(req);
    if (!userId) {
      return unauthorizedResponse();
    }

    const parsed = UploadUrlRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: parsed.error.issues }, { status: 400 });
    }
    const { key, contentType, expiresIn = 3600 } = parsed.data;

    if (!(await canAccessKey(key, userId))) {
      return NextResponse.json(
        { error: 'Forbidden key scope. Use users/<your-user-id>/... or projects/<your-project-id>/...' },
        { status: 403 }
      );
    }

    logger.info({ key, contentType, expiresIn, userId }, 'Generating upload URL');

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
