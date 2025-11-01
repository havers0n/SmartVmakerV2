import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { generationProjects } from '@/shared/lib/schema';
import { eq } from 'drizzle-orm';

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
    const projectId = params.project_id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const [project] = await db
      .select()
      .from(generationProjects)
      .where(eq(generationProjects.id, projectId))
      .limit(1);

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
