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

    // Use raw SQL to fetch assets for the project
    // Filter by asset_type = 'keyframe'
    // Sort by sceneIndex (int) and frameType
    const result = await db.execute(sql`
      SELECT *
      FROM generation_pipeline.assets
      WHERE generation_project_id = ${project_id}
        AND asset_type = 'keyframe'
      ORDER BY 
        (meta->>'sceneIndex')::int ASC,
        (meta->>'frameType') ASC
    `);

    const assets = result.rows;

    const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;

    // Enrich assets with public_url (snake_case)
    const assetsWithPublicUrl = assets.map((asset: any) => ({
      ...asset,
      public_url:
        asset.storage_url && PUBLIC_BASE_URL
          ? `${PUBLIC_BASE_URL}/${asset.storage_url}`
          : null,
    }));

    return NextResponse.json(assetsWithPublicUrl);
  } catch (error) {
    console.error('Failed to fetch project assets:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}