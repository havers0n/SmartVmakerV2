// apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { sql } from 'drizzle-orm';
import { generationProjects } from '@/shared/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { project_id: string } }
) {
  try {
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    const { project_id } = params;

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const [project] = await db
      .select({ id: generationProjects.id })
      .from(generationProjects)
      .where(and(eq(generationProjects.id, project_id), eq(generationProjects.ownerId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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

    // Debug logging
    console.log('[Assets API]', {
      projectId: project_id,
      assetsCount: assets.length,
      hasPublicBaseUrl: !!PUBLIC_BASE_URL,
      publicBaseUrl: PUBLIC_BASE_URL || 'NOT SET',
      sampleAsset: assets[0] ? {
        id: assets[0].id,
        storage_url: assets[0].storage_url,
        status: assets[0].status,
        asset_type: assets[0].asset_type,
      } : null,
    });

    // Enrich assets with public_url (snake_case)
    const assetsWithPublicUrl = assets.map((asset: any) => {
      let public_url: string | null = null;

      // Check if storage_url exists and is not empty
      if (asset.storage_url && asset.storage_url.trim() !== '') {
        if (PUBLIC_BASE_URL) {
          // Remove trailing slash from base URL and leading slash from storage_url
          const baseUrl = PUBLIC_BASE_URL.replace(/\/$/, '');
          const storagePath = asset.storage_url.replace(/^\//, '');
          public_url = `${baseUrl}/${storagePath}`;
        } else {
          // Fallback: log warning if public URL is not configured
          console.warn(
            '[Assets API] NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not set. Public URLs will be null.',
            { assetId: asset.id, storage_url: asset.storage_url }
          );
        }
      } else {
        // Log warning if storage_url is missing or empty
        console.warn(
          '[Assets API] Asset has no valid storage_url',
          { 
            assetId: asset.id, 
            status: asset.status,
            storage_url: asset.storage_url || '(empty)',
            asset_type: asset.asset_type
          }
        );
      }

      return {
        ...asset,
        public_url,
      };
    });

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
