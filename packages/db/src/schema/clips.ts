import { pgTable, uuid, text, integer, timestamp, foreignKey, index } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';

export const clips = pgTable(
  'clips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: text('task_id').notNull(),
    beatId: text('beat_id'),
    publicUrl: text('public_url'),
    durationS: integer('duration_s'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    taskIdFk: foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
    }),
    taskIdIdx: index('idx_clips_task').on(table.taskId),
  }),
);

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
