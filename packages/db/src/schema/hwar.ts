/**
 * HWAR (HelloWhoAreYou) Schema
 */

import { pgTable, uuid, text, integer, jsonb, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const scenarios = pgTable(
  'hwar_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    durationSec: integer('duration_sec').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('hwar_scenarios_created_at_idx').on(table.createdAt),
    topicIdx: index('hwar_scenarios_topic_idx').on(table.topic),
    durationCheck: check('hwar_scenarios_duration_check', sql`${table.durationSec} BETWEEN 5 AND 300`),
  })
);

export const harvests = pgTable(
  'hwar_harvests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    query: text('query').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('hwar_harvests_created_at_idx').on(table.createdAt),
  })
);
