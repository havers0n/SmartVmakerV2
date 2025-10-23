import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { type TaskKind, type TaskStatus } from '@scrimspec/shared-types';

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<TaskKind>().notNull(),
    status: text('status').$type<TaskStatus>().notNull(),
    prompt: text('prompt'),
    params: jsonb('params'),
    fileId: text('file_id'),
    publicUrl: text('public_url'),
    errorText: text('error'),
    batchId: text('batch_id'),
    topic: text('topic'),
    lang: text('lang'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index('idx_tasks_status').on(table.status),
    batchIdx: index('idx_tasks_batch').on(table.batchId),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
