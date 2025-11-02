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