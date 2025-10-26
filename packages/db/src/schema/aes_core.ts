import { integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const beats = pgTable('beats', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    template_id: uuid('template_id').notNull(),
    order: integer('order').notNull(),
    phase: text('phase').notNull(),
    duration_seconds: real('duration_seconds').notNull(),
    description: text('description').notNull(),
    action_prompt: text('action_prompt'),
    emotion: text('emotion').notNull(),
    contrast: text('contrast'),
    intended_impact: text('intended_impact'),
    meta: jsonb('meta').notNull().default('{}'),
});


export type Beats = typeof beats.$inferSelect;

export type NewBeats = typeof beats.$inferInsert;


export const storyTemplates = pgTable('story_templates', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    tags: text('tags').$type<string[]>(),
    target_duration_seconds: integer('target_duration_seconds').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});


export type StoryTemplates = typeof storyTemplates.$inferSelect;

export type NewStoryTemplates = typeof storyTemplates.$inferInsert;
