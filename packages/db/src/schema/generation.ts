import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  jsonb,
  real,
  foreignKey,
} from 'drizzle-orm/pg-core';

/**
 * Generation Pipeline - Shorts
 * A "short" is a template-based video composition.
 */
export const generationShorts = pgTable(
  'generation_pipeline.shorts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: text('template_id').notNull(), // Reference to template
    status: text('status')
      .notNull()
      .default('pending'), // 'pending', 'processing', 'completed', 'failed'
    error: text('error'), // Error message if failed
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index('idx_shorts_status').on(table.status),
    templateIdIdx: index('idx_shorts_template_id').on(table.templateId),
    createdAtIdx: index('idx_shorts_created_at').on(table.createdAt),
  }),
);

export type GenerationShort = typeof generationShorts.$inferSelect;
export type NewGenerationShort = typeof generationShorts.$inferInsert;

/**
 * Generation Pipeline - Assets
 * Individual assets (clips, images, etc.) that make up a short.
 */
export const generationAssets = pgTable(
  'generation_pipeline.assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shortId: uuid('short_id').notNull(),
    beatId: text('beat_id'), // Reference to beat in template
    assetType: text('asset_type').notNull(), // 'video_clip', 'image', 'audio', 'text'
    status: text('status')
      .notNull()
      .default('pending'), // 'pending', 'processing', 'completed', 'failed'
    storageUrl: text('storage_url'), // URL in Supabase Storage where result is stored
    apiCostUsd: real('api_cost_usd'), // Cost of generating this asset
    meta: jsonb('meta'), // Custom metadata: prompt, emotion, phase, etc.
    error: text('error'), // Error message if generation failed
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shortIdFk: foreignKey({
      columns: [table.shortId],
      foreignColumns: [generationShorts.id],
    }),
    shortIdIdx: index('idx_assets_short_id').on(table.shortId),
    statusIdx: index('idx_assets_status').on(table.status),
    createdAtIdx: index('idx_assets_created_at').on(table.createdAt),
  }),
);

export type GenerationAsset = typeof generationAssets.$inferSelect;
export type NewGenerationAsset = typeof generationAssets.$inferInsert;

/**
 * Generation Pipeline - Job Queue
 * Queue for generation jobs (tracks provider, status, etc.)
 */
export const generationQueue = pgTable(
  'generation_pipeline.jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id').notNull(),
    provider: text('provider')
      .notNull()
      .default('minimax'), // 'minimax', 'hailuo', etc.
    status: text('status')
      .notNull()
      .default('pending'), // 'pending', 'processing', 'done', 'failed'
    error: text('error'), // Error details if failed
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    assetIdFk: foreignKey({
      columns: [table.assetId],
      foreignColumns: [generationAssets.id],
    }),
    assetIdIdx: index('idx_jobs_asset_id').on(table.assetId),
    statusIdx: index('idx_jobs_status').on(table.status),
    createdAtIdx: index('idx_jobs_created_at').on(table.createdAt),
  }),
);

export type GenerationQueue = typeof generationQueue.$inferSelect;
export type NewGenerationQueue = typeof generationQueue.$inferInsert;
