import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(), // sha256(prompt+ar+model)
    kind: text('kind').notNull(), // 'image', 'video', 'audio'
    prompt: text('prompt'),
    aspectRatio: text('aspect_ratio'),
    model: text('model'),
    url: text('url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    promptIdx: index('idx_assets_prompt').on(table.prompt),
    kindIdx: index('idx_assets_kind').on(table.kind),
  }),
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
