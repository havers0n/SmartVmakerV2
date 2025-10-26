import { jsonb, numeric, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const assetGenerationJobs = pgTable('asset_generation_jobs', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    asset_id: uuid('asset_id').notNull(),
    provider: text('provider').notNull().default('minimax'),
    error: text('error'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status').notNull().default('pending'),
});


export type AssetGenerationJobs = typeof assetGenerationJobs.$inferSelect;

export type NewAssetGenerationJobs = typeof assetGenerationJobs.$inferInsert;


export const assets = pgTable('assets', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    generation_project_id: uuid('generation_project_id').notNull(),
    beat_id: uuid('beat_id'),
    asset_type: text('asset_type').notNull(),
    storage_url: text('storage_url').notNull(),
    minimax_job_id: text('minimax_job_id'),
    storage_bucket: text('storage_bucket'),
    storage_path: text('storage_path'),
    content_hash: text('content_hash'),
    api_cost_usd: numeric('api_cost_usd'),
    meta: jsonb('meta').notNull().default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    status: text('status').notNull().default('pending'),
});


export type Assets = typeof assets.$inferSelect;

export type NewAssets = typeof assets.$inferInsert;


export const generationProjects = pgTable('generation_projects', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    template_id: uuid('template_id'),
    final_video_url: text('final_video_url'),
    minimax_cost: real('minimax_cost'),
    error_message: text('error_message'),
    owner_id: uuid('owner_id'),
    channel_id: text('channel_id'),
    youtube_video_id: text('youtube_video_id'),
    upload_status: text('upload_status').default('draft'),
    api_cost_usd: numeric('api_cost_usd'),
    meta: jsonb('meta').notNull().default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
});


export type GenerationProjects = typeof generationProjects.$inferSelect;

export type NewGenerationProjects = typeof generationProjects.$inferInsert;
