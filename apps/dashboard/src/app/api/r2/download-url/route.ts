import { NextRequest, NextResponse } from 'next/server';
import { createDownloadUrl } from '@aec/storage-client';
import { createLogger } from '@aec/logger';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { generationProjects } from '@/shared/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

const logger = createLogger({ name: 'api-r2-download-url' });

const DownloadUrlRequestSchema = z.object({
  key: z.string().min(3).max(1024),
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
    const userId = getTrustedUserId(req);
    if (!userId) {
      return unauthorizedResponse();
    }

    const parsed = DownloadUrlRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: parsed.error.issues }, { status: 400 });
    }
    const { key, expiresIn = 3600 } = parsed.data;

    if (!(await canAccessKey(key, userId))) {
      return NextResponse.json(
        { error: 'Forbidden key scope. Use users/<your-user-id>/... or projects/<your-project-id>/...' },
        { status: 403 }
      );
    }

    logger.info({ key, expiresIn, userId }, 'Generating download URL');

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
