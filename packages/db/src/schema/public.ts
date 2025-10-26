import { bigint, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const analysisResults = pgTable('analysis_results', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    analyzer: text('analyzer').notNull(),
    analysis_url: text('analysis_url'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    aes_breakdown: jsonb('aes_breakdown'),
    overall_score: numeric('overall_score'),
    emotional_tags: jsonb('emotional_tags'),
    analyzer_name: text('analyzer_name'),
    version: integer('version').notNull(),
    video_id: uuid('video_id').notNull(),
});


export type AnalysisResults = typeof analysisResults.$inferSelect;

export type NewAnalysisResults = typeof analysisResults.$inferInsert;


export const auditLog = pgTable('audit_log', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    table_name: text('table_name').notNull(),
    record_id: text('record_id').notNull(),
    action: text('action').notNull(),
    old_data: jsonb('old_data'),
    new_data: jsonb('new_data'),
    changed_fields: text('changed_fields').$type<string[]>(),
    user_id: uuid('user_id'),
    ip_address: text('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type AuditLog = typeof auditLog.$inferSelect;

export type NewAuditLog = typeof auditLog.$inferInsert;


export const batches = pgTable('batches', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    plan_path: text('plan_path'),
    total: integer('total').notNull(),
    ok: integer('ok').notNull(),
    fail: integer('fail').notNull(),
    avg_time_ms: integer('avg_time_ms'),
    quality_score: integer('quality_score'),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finished_at: timestamp('finished_at', { withTimezone: true }),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
});


export type Batches = typeof batches.$inferSelect;

export type NewBatches = typeof batches.$inferInsert;


export const clips = pgTable('clips', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    legacy_task_id: text('legacy_task_id').notNull(),
    beat_id: text('beat_id'),
    public_url: text('public_url'),
    duration_s: integer('duration_s'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    task_id: uuid('task_id').notNull(),
});


export type Clips = typeof clips.$inferSelect;

export type NewClips = typeof clips.$inferInsert;


export const generationEvents = pgTable('generation_events', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    user_id: text('user_id'),
    topic: text('topic'),
    duration_category: text('duration_category'),
    scenario: jsonb('scenario'),
    candidates: jsonb('candidates'),
    chosen_index: integer('chosen_index'),
    compose_job_id: text('compose_job_id'),
    status: text('status').default('draft'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    chosen_first_asset_legacy_id: text('chosen_first_asset_legacy_id'),
    chosen_last_asset_legacy_id: text('chosen_last_asset_legacy_id'),
    aes_score: numeric('aes_score'),
    hook_strength: numeric('hook_strength'),
    emotional_curve: text('emotional_curve').$type<string[]>(),
    evaluator: text('evaluator'),
    chosen_first_asset_id: uuid('chosen_first_asset_id'),
    chosen_last_asset_id: uuid('chosen_last_asset_id'),
});


export type GenerationEvents = typeof generationEvents.$inferSelect;

export type NewGenerationEvents = typeof generationEvents.$inferInsert;


export const idUuidMapping = pgTable('id_uuid_mapping', {
    table_name: text('table_name').notNull().primaryKey(),
    legacy_id: text('legacy_id').notNull().primaryKey(),
    uuid_id: uuid('uuid_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});


export type IdUuidMapping = typeof idUuidMapping.$inferSelect;

export type NewIdUuidMapping = typeof idUuidMapping.$inferInsert;


export const jsonSchemas = pgTable('json_schemas', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    schema_name: text('schema_name').notNull(),
    schema_version: text('schema_version').notNull().default('1.0'),
    schema_def: jsonb('schema_def').notNull(),
    description: text('description'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


export type JsonSchemas = typeof jsonSchemas.$inferSelect;

export type NewJsonSchemas = typeof jsonSchemas.$inferInsert;


export const legacyTasks = pgTable('legacy_tasks', {
    legacy_id: text('legacy_id').notNull(),
    kind: text('kind').notNull(),
    prompt: text('prompt'),
    public_url: text('public_url'),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finished_at: timestamp('finished_at', { withTimezone: true }),
    params: jsonb('params'),
    file_id: text('file_id'),
    error: text('error'),
    batch_id: uuid('batch_id'),
    topic: text('topic'),
    lang: text('lang'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    status: text('status').notNull().default('pending'),
});


export type LegacyTasks = typeof legacyTasks.$inferSelect;

export type NewLegacyTasks = typeof legacyTasks.$inferInsert;


export const youtubeVideos = pgTable('youtube_videos', {
    url: text('url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    published_at: timestamp('published_at', { withTimezone: true }),
    channel_title: text('channel_title'),
    duration_seconds: integer('duration_seconds'),
    view_count: bigint('view_count', { mode: 'number' }),
    like_count: bigint('like_count', { mode: 'number' }),
    comment_count: bigint('comment_count', { mode: 'number' }),
    tags: jsonb('tags').default('[]'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    youtube_id: text('youtube_id'),
    id: uuid('id').notNull().defaultRandom().primaryKey(),
});


export type YoutubeVideos = typeof youtubeVideos.$inferSelect;

export type NewYoutubeVideos = typeof youtubeVideos.$inferInsert;
