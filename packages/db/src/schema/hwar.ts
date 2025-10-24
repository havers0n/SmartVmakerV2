/**
 * HWAR (HelloWhoAreYou) Schema
 */

import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const scenarios = pgTable('hwar_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: text('topic').notNull(),
  durationSec: integer('duration_sec').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const harvests = pgTable('hwar_harvests', {
  id: uuid('id').primaryKey().defaultRandom(),
  query: text('query').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
