import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { generationProjects, contentFormats, storyTemplates } from '@scrimspec/db';
import { eq, and, isNull } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/generation/projects/[project_id]
 * Fetch a single generation project by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { project_id: string } }
) {
  try {
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    const projectId = params.project_id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Fetch project using Drizzle ORM
    const [row] = await db
      .select({ project: generationProjects, contentFormat: { id: contentFormats.id, name: contentFormats.name, slug: contentFormats.slug, status: contentFormats.status }, storyTemplate: { id: storyTemplates.id, name: storyTemplates.name } })
      .from(generationProjects)
      .leftJoin(contentFormats, eq(contentFormats.id, generationProjects.contentFormatId))
      .leftJoin(storyTemplates, eq(storyTemplates.id, generationProjects.templateId))
      .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)));

    if (!row) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...row.project, contentFormat: row.contentFormat?.id ? row.contentFormat : null, storyTemplate: row.storyTemplate?.id ? row.storyTemplate : null });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/generation/projects/[project_id]
 * Soft delete a generation project
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { project_id: string } }
) {
  try {
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    const projectId = params.project_id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Perform soft delete using Drizzle ORM
    const updated = await db
      .update(generationProjects)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(
        eq(generationProjects.id, projectId),
        eq(generationProjects.ownerId, userId),
        isNull(generationProjects.deletedAt)
      ))
      .returning({ id: generationProjects.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
