import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const analysisJobQueue = pgTable('analysis_job_queue', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    analyzer: text('analyzer').notNull(),
    error: text('error'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    error_message: text('error_message'),
    video_id: uuid('video_id').notNull(),
    status: text('status').notNull().default('pending'),
    retry_count: integer('retry_count').notNull(),
});


export type AnalysisJobQueue = typeof analysisJobQueue.$inferSelect;

export type NewAnalysisJobQueue = typeof analysisJobQueue.$inferInsert;


export const generationJobQueue = pgTable('generation_job_queue', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    asset_id: uuid('asset_id').notNull(),
    provider: text('provider').notNull(),
    error: text('error'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    error_message: text('error_message'),
    status: text('status').notNull().default('pending'),
    retry_count: integer('retry_count').notNull(),
});


export type GenerationJobQueue = typeof generationJobQueue.$inferSelect;

export type NewGenerationJobQueue = typeof generationJobQueue.$inferInsert;


export const ingestJobQueue = pgTable('ingest_job_queue', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    query: text('query').notNull(),
    published_after: timestamp('published_after', { withTimezone: true }),
    duration: integer('duration'),
    error: text('error'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    error_message: text('error_message'),
    status: text('status').notNull().default('pending'),
    retry_count: integer('retry_count').notNull(),
});


export type IngestJobQueue = typeof ingestJobQueue.$inferSelect;

export type NewIngestJobQueue = typeof ingestJobQueue.$inferInsert;
