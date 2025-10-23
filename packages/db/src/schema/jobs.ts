import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * YouTube ingestion job queue
 * Tracks jobs for searching and ingesting videos from YouTube
 */
export const ingestQueue = pgTable(
  'ingest_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    query: text('query').notNull(), // Search query (keywords)
    publishedAfter: timestamp('published_after', { withTimezone: true }), // Only videos after this date
    duration: text('duration').default('short').notNull(), // 'short', 'medium', 'long'
    status: text('status')
      .notNull()
      .default('pending'), // 'pending', 'processing', 'done', 'failed'
    error: text('error'), // Error message if failed
    metadata: jsonb('metadata'), // Additional data (limit, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('idx_ingest_queue_status').on(table.status),
    createdAtIdx: index('idx_ingest_queue_created_at').on(table.createdAt),
  }),
);

export type IngestQueue = typeof ingestQueue.$inferSelect;
export type NewIngestQueue = typeof ingestQueue.$inferInsert;

/**
 * Video analysis job queue
 * Tracks jobs for analyzing videos with different analyzers
 */
export const analysisQueue = pgTable(
  'analysis_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: text('video_id').notNull(), // YouTube video ID
    analyzer: text('analyzer').notNull(), // 'gemini', 'nanobanana', etc.
    status: text('status')
      .notNull()
      .default('pending'), // 'pending', 'processing', 'done', 'failed'
    error: text('error'), // Error message if failed
    metadata: jsonb('metadata'), // Additional data
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('idx_analysis_queue_video_id').on(table.videoId),
    statusIdx: index('idx_analysis_queue_status').on(table.status),
    analyzerIdx: index('idx_analysis_queue_analyzer').on(table.analyzer),
    createdAtIdx: index('idx_analysis_queue_created_at').on(table.createdAt),
  }),
);

export type AnalysisQueue = typeof analysisQueue.$inferSelect;
export type NewAnalysisQueue = typeof analysisQueue.$inferInsert;
