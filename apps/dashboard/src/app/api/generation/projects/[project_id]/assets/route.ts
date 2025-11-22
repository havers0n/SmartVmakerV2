// apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { project_id: string } }
) {
  try {
    const { project_id } = params;

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Use raw SQL to fetch assets for the project, ordered by createdAt
    const result = await db.execute(sql`
      SELECT *
      FROM generation_pipeline.assets
      WHERE generation_project_id = ${project_id}
      ORDER BY created_at ASC
    `);

    const assets = result.rows;

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Failed to fetch project assets:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}