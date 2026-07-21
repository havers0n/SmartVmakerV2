import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { generationProjects } from '@scrimspec/db';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/generation/projects/bulk-delete
 * Soft delete multiple generation projects
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { projectIds } = body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Project IDs array is required' },
        { status: 400 }
      );
    }

    // Validate that all IDs are strings
    if (!projectIds.every((id: unknown) => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All project IDs must be strings' },
        { status: 400 }
      );
    }

    // Perform soft delete using Drizzle ORM
    const updated = await db
      .update(generationProjects)
      .set({ deletedAt: new Date().toISOString() })
      .where(
        and(
          inArray(generationProjects.id, projectIds),
          eq(generationProjects.ownerId, userId),
          isNull(generationProjects.deletedAt)
        )
      )
      .returning({ id: generationProjects.id });

    return NextResponse.json({ 
      success: true, 
      deletedCount: updated.length,
      deletedIds: updated.map(p => p.id)
    });
  } catch (error) {
    console.error('Failed to bulk delete projects:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}


