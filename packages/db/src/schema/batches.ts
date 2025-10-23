import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { type TaskStatus } from '@scrimspec/shared-types';

export const batches = pgTable(
  'batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planPath: text('plan_path'),
    status: text('status').$type<TaskStatus>().notNull().default('queued'),
    total: integer('total').notNull().default(0),
    ok: integer('ok').notNull().default(0),
    fail: integer('fail').notNull().default(0),
    avgTimeMs: integer('avg_time_ms'),
    qualityScore: integer('quality_score'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index('idx_batches_status').on(table.status),
  }),
);

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;
