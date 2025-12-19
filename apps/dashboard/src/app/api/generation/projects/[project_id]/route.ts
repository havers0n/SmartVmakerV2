import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { generationProjects } from '@scrimspec/db';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/generation/projects/[project_id]
 * Fetch a single generation project by ID
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { project_id: string } }
) {
  try {
    const projectId = params.project_id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Fetch project using Drizzle ORM
    const [project] = await db
      .select()
      .from(generationProjects)
      .where(eq(generationProjects.id, projectId));

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
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
  _req: NextRequest,
  { params }: { params: { project_id: string } }
) {
  try {
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