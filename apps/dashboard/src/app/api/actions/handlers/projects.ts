import { db } from '@/shared/lib/db';
import { createLogger } from '@aec/logger';
import { generationProjects, assets, keyframeJobQueue } from '@/shared/lib/schema';
import { desc, isNull, eq, and, sql } from 'drizzle-orm';

const logger = createLogger({ name: 'api-projects' });

/**
 * List all generation projects
 * Returns projects sorted by createdAt in descending order (newest first)
 * Selects only necessary fields for the project list: id, status, and meta (especially title)
 */
export async function listProjects() {
  logger.info('Listing all generation projects');

  try {
    // Use Drizzle ORM for type safety
    const projects = await db
      .select({
        id: generationProjects.id,
        status: generationProjects.status,
        meta: generationProjects.meta,
        createdAt: generationProjects.createdAt,
        scenesCount: sql<number>`COUNT(DISTINCT ${keyframeJobQueue.sceneIndex})`,
        keyframesCount: sql<number>`COUNT(DISTINCT CASE WHEN ${assets.assetType} = 'keyframe' THEN ${assets.id} END)`,
        hasFinalVideo: sql<boolean>`
          COALESCE(BOOL_OR(${assets.assetType} = 'final_video' AND ${assets.deletedAt} IS NULL), false)
          OR COALESCE(BOOL_OR(${generationProjects.finalVideoUrl} IS NOT NULL), false)
        `,
      })
      .from(generationProjects)
      .leftJoin(keyframeJobQueue, eq(keyframeJobQueue.projectId, generationProjects.id))
      .leftJoin(
        assets,
        and(
          eq(assets.generationProjectId, generationProjects.id),
          isNull(assets.deletedAt),
        ),
      )
      .where(isNull(generationProjects.deletedAt))
      .groupBy(
        generationProjects.id,
        generationProjects.status,
        generationProjects.meta,
        generationProjects.createdAt,
        generationProjects.finalVideoUrl,
      )
      .orderBy(desc(generationProjects.createdAt));

    logger.info({ count: projects.length }, 'Projects retrieved successfully');

    // Return only the necessary fields for the UI
    return projects.map((project) => ({
      id: project.id,
      status: project.status,
      // Extract title from meta if it exists
      title: project.meta && typeof project.meta === 'object' && 'title' in project.meta
        ? (project.meta as { title?: string }).title || 'Untitled Project'
        : 'Untitled Project',
      createdAt: project.createdAt,
      scenesCount: Number(project.scenesCount ?? 0),
      keyframesCount: Number(project.keyframesCount ?? 0),
      hasFinalVideo: Boolean(project.hasFinalVideo),
    }));
  } catch (error) {
    logger.error('Failed to list projects', { error });
    throw error;
  }
}
