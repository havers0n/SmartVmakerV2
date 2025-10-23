import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * YouTube videos metadata storage
 * Stores video information fetched from YouTube API
 */
export const youtubeVideos = pgTable(
  'youtube_videos',
  {
    id: text('id').primaryKey(), // YouTube video ID
    url: text('url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    channelTitle: text('channel_title'),
    durationSeconds: integer('duration_seconds'),
    viewCount: bigint('view_count', { mode: 'number' }).default(0),
    likeCount: bigint('like_count', { mode: 'number' }).default(0),
    commentCount: bigint('comment_count', { mode: 'number' }).default(0),
    tags: jsonb('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publishedAtIdx: index('idx_youtube_videos_published_at').on(
      table.publishedAt,
    ),
    createdAtIdx: index('idx_youtube_videos_created_at').on(table.createdAt),
  }),
);

export type YouTubeVideo = typeof youtubeVideos.$inferSelect;
export type NewYouTubeVideo = typeof youtubeVideos.$inferInsert;

/**
 * Video analysis results
 * Stores analysis output (emotional architecture, frames, etc.)
 */
export const videoAnalysis = pgTable(
  'video_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    videoId: text('video_id').notNull(),
    analyzer: text('analyzer').notNull(), // 'gemini', 'nanobanana', etc.
    analysisUrl: text('analysis_url'), // Link to stored analysis JSON
    metadata: jsonb('metadata'), // Any additional metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdIdx: index('idx_video_analysis_video_id').on(table.videoId),
    analyzerIdx: index('idx_video_analysis_analyzer').on(table.analyzer),
  }),
);

export type VideoAnalysis = typeof videoAnalysis.$inferSelect;
export type NewVideoAnalysis = typeof videoAnalysis.$inferInsert;
