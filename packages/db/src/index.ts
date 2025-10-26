/**
 * Scrimspec Database Layer
 * Drizzle ORM for PostgreSQL + Supabase integration
 */

export {
  getDrizzleClient,
  getPgClient,
  getSupabaseClient,
  type DB,
  schema,
} from './client';

// Re-export all schemas
export * from './schema';

// Named exports with proper mappings for common use cases
import * as publicSchema from './schema/public';
import * as jobsSchema from './schema/jobs';
import * as studioSchema from './schema/studio';
import * as generationSchema from './schema/generation_pipeline';
import * as aesSchema from './schema/aes_core';
import * as analyticsSchema from './schema/analytics';

/**
 * Consolidated schema exports with aliases for backward compatibility
 * This mapping layer ensures consistency between different naming conventions
 */
const tables = {
  // Job Queues
  analysisJobQueue: jobsSchema.analysisJobQueue,
  generationJobQueue: jobsSchema.generationJobQueue,
  ingestJobQueue: jobsSchema.ingestJobQueue,

  // Public tables
  youtubeVideos: publicSchema.youtubeVideos,
  analysisResults: publicSchema.analysisResults,
  batches: publicSchema.batches,
  clips: publicSchema.clips,
  generationEvents: publicSchema.generationEvents,
  legacyTasks: publicSchema.legacyTasks,
  auditLog: publicSchema.auditLog,
  idUuidMapping: publicSchema.idUuidMapping,
  jsonSchemas: publicSchema.jsonSchemas,

  // Generation Pipeline
  assets: generationSchema.assets,
  assetGenerationJobs: generationSchema.assetGenerationJobs,
  generationProjects: generationSchema.generationProjects,

  // AES Core
  beats: aesSchema.beats,
  storyTemplates: aesSchema.storyTemplates,

  // Analytics
  metricsSnapshots: analyticsSchema.metricsSnapshots,
  performanceMetrics: analyticsSchema.performanceMetrics,

  // Studio (simplified tables for UI)
  scenarios: studioSchema.scenarios,
  harvests: studioSchema.harvests,
  hwar_analysis_tasks: studioSchema.analysisTasks,
  hwar_batches: studioSchema.batches,
  hwar_characters: studioSchema.characters,
  hwar_datasets: studioSchema.datasets,
  hwar_presets: studioSchema.presets,
  hwar_queues: studioSchema.queues,
  hwar_templates: studioSchema.templates,
  hwar_workers: studioSchema.workers,
};

// Export the tables mapping
export { tables };
