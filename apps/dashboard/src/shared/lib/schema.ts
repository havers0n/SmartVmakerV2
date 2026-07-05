/**
 * Re-export schema tables from @scrimspec/db
 * Using specific imports to avoid name conflicts
 */

import * as schema from "@scrimspec/db";

// Job queue tables - use tables mapping for consistency
export const ingestJobQueue = schema.ingestJobQueue;
export const analysisJobQueue = schema.analysisJobQueue;
export const generationJobQueue = schema.generationJobQueue;
export const keyframeJobQueue = schema.keyframeJobQueue;
export const animationJobQueue = schema.animationJobQueue;
export const generationAnimationJobs = schema.generationAnimationJobs;

// Public tables - use tables mapping to get correct references
export const youtubeVideos = schema.youtubeVideos;
export const analysisResults = schema.analysisResults;
export const batches = schema.batches;
export const clips = schema.clips;
export const generationEvents = schema.generationEvents;
export const legacyTasks = schema.legacyTasks;
export const auditLog = schema.auditLog;

// Generation Pipeline - use tables mapping for consistency
export const generationProjects = schema.generationProjects;
export const assets = schema.assets;

// AES Core - use tables mapping for consistency
export const beats = schema.beats;
export const storyTemplates = schema.storyTemplates;
export const characters = schema.characters;

// AI Providers & Models - use tables mapping for consistency
export const aiProviders = schema.aiProviders;
export const aiModels = schema.aiModels;

// BeamNG Analytics tables
export const niches = schema.niches;
export const nicheQueries = schema.nicheQueries;
export const discoveryRuns = schema.discoveryRuns;
export const videoDiscoveries = schema.videoDiscoveries;
export const youtubeChannels = schema.youtubeChannels;
export const importSessions = schema.importSessions;
