import { db } from '@/shared/lib/db';
import { generationProjects } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { desc, sql } from 'drizzle-orm';

const logger = createLogger({ name: 'api-projects' });

/**
 * List all generation projects
 * Returns projects sorted by createdAt in descending order (newest first)
 * Selects only necessary fields for the project list: id, status, and meta (especially title)
 */
export async function listProjects() {
  logger.info('Listing all generation projects');

  try {
    // Use raw SQL to avoid typing issues with Drizzle ORM
    const result = await db.execute(sql`
      SELECT 
        id, 
        status, 
        meta, 
        created_at as "createdAt"
      FROM generation_pipeline.generation_projects
      ORDER BY created_at DESC
    `);

    const projects = result.rows;

    logger.info({ count: projects.length }, 'Projects retrieved successfully');

    // Return only the necessary fields for the UI
    return projects.map((project: any) => ({
      id: project.id,
      status: project.status,
      // Extract title from meta if it exists
      title: project.meta && typeof project.meta === 'object' && 'title' in project.meta 
        ? (project.meta as { title?: string }).title || 'Untitled Project'
        : 'Untitled Project',
      createdAt: project.createdAt,
    }));
  } catch (error) {
    logger.error('Failed to list projects', { error });
    throw error;
  }
}

/**
 * Get detailed information for a specific generation project by ID
 * Returns full project details including all metadata
 */
export async function getProjectById(payload: { id: string }) {
  logger.info('Getting project by ID', { projectId: payload.id });

  try {
    // Use raw SQL to avoid typing issues with Drizzle ORM
    const result = await db.execute(sql`
      SELECT 
        id, 
        owner_id as "ownerId",
        template_id as "templateId",
        status, 
        final_video_url as "finalVideoUrl",
        api_cost_usd as "apiCostUsd",
        channel_id as "channelId",
        error_message as "errorMessage",
        minimax_cost as "minimaxCost",
        upload_status as "uploadStatus",
        youtube_video_id as "youtubeVideoId",
        meta,
        created_at as "createdAt",
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
      FROM generation_pipeline.generation_projects
      WHERE id = ${payload.id}
    `);

    const project = result.rows[0];

    if (!project) {
      logger.warn('Project not found', { projectId: payload.id });
      throw new Error(`Project with ID ${payload.id} not found`);
    }

    logger.info('Project retrieved successfully', { projectId: payload.id });

    // Return the full project details
    return {
      id: project.id,
      ownerId: project.ownerId,
      templateId: project.templateId,
      status: project.status,
      finalVideoUrl: project.finalVideoUrl,
      apiCostUsd: project.apiCostUsd,
      channelId: project.channelId,
      errorMessage: project.errorMessage,
      minimaxCost: project.minimaxCost,
      uploadStatus: project.uploadStatus,
      youtubeVideoId: project.youtubeVideoId,
      meta: project.meta,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
    };
  } catch (error) {
    logger.error('Failed to get project by ID', { error, projectId: payload.id });
    throw error;
  }
}