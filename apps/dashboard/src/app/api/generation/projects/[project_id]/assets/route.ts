import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { assets } from '@/shared/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/generation/projects/[project_id]/assets
 * Fetch all assets for a generation project
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

    const projectAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.generationProjectId, projectId));

    return NextResponse.json(projectAssets);
  } catch (error) {
    console.error('Failed to fetch project assets:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
