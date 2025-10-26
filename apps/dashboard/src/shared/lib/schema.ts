/**
 * Re-export schema tables from @scrimspec/db
 * Using specific imports to avoid name conflicts
 */

import { tables } from '@scrimspec/db';

// HWAR Studio tables (simplified UI tables) - use tables mapping to get correct references
export const scenarios = tables.scenarios;
export const harvests = tables.harvests;
export const hwar_analysis_tasks = tables.hwar_analysis_tasks;
export const hwar_batches = tables.hwar_batches;
export const hwar_characters = tables.hwar_characters;
export const hwar_datasets = tables.hwar_datasets;
export const hwar_presets = tables.hwar_presets;
export const hwar_queues = tables.hwar_queues;
export const hwar_templates = tables.hwar_templates;
export const hwar_workers = tables.hwar_workers;

// Job queue tables - use tables mapping for consistency
export const ingestJobQueue = tables.ingestJobQueue;
export const analysisJobQueue = tables.analysisJobQueue;
export const generationJobQueue = tables.generationJobQueue;

// Public tables - use tables mapping to get correct references
export const youtubeVideos = tables.youtubeVideos;
export const analysisResults = tables.analysisResults;
export const batches = tables.batches;
export const clips = tables.clips;
export const generationEvents = tables.generationEvents;
export const legacyTasks = tables.legacyTasks;
export const auditLog = tables.auditLog;

// Generation Pipeline - use tables mapping for consistency
export const generationProjects = tables.generationProjects;
export const assets = tables.assets;
export const assetGenerationJobs = tables.assetGenerationJobs;

// AES Core - use tables mapping for consistency
export const beats = tables.beats;
export const storyTemplates = tables.storyTemplates;

// Analytics - use tables mapping for consistency
export const metricsSnapshots = tables.metricsSnapshots;
export const performanceMetrics = tables.performanceMetrics;