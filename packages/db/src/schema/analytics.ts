import { bigint, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const metricsSnapshots = pgTable('metrics_snapshots', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    generation_project_id: uuid('generation_project_id').notNull(),
    snapshot_at: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
    views: bigint('views', { mode: 'number' }),
    likes: bigint('likes', { mode: 'number' }),
    comments: integer('comments'),
    watch_time_seconds: real('watch_time_seconds'),
    retention_percentage: real('retention_percentage'),
});


export type MetricsSnapshots = typeof metricsSnapshots.$inferSelect;

export type NewMetricsSnapshots = typeof metricsSnapshots.$inferInsert;


export const performanceMetrics = pgTable('performance_metrics', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    generation_project_id: uuid('generation_project_id').notNull(),
    youtube_url: text('youtube_url'),
    views: bigint('views', { mode: 'number' }),
    likes: bigint('likes', { mode: 'number' }),
    comments: integer('comments'),
    watch_time_seconds: real('watch_time_seconds'),
    retention_percentage: real('retention_percentage'),
    engagement_rate: real('engagement_rate'),
    like_rate: real('like_rate'),
    viral_score: real('viral_score'),
    last_updated: timestamp('last_updated', { withTimezone: true }).defaultNow(),
});


export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

export type NewPerformanceMetrics = typeof performanceMetrics.$inferInsert;
