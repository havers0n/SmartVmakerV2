import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const analysisTasks = pgTable('analysis_tasks', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type AnalysisTasks = typeof analysisTasks.$inferSelect;

export type NewAnalysisTasks = typeof analysisTasks.$inferInsert;


export const batches = pgTable('batches', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Batches = typeof batches.$inferSelect;

export type NewBatches = typeof batches.$inferInsert;


export const characters = pgTable('characters', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    meta: jsonb('meta').default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Characters = typeof characters.$inferSelect;

export type NewCharacters = typeof characters.$inferInsert;


export const datasets = pgTable('datasets', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Datasets = typeof datasets.$inferSelect;

export type NewDatasets = typeof datasets.$inferInsert;


export const harvests = pgTable('harvests', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    query: text('query').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Harvests = typeof harvests.$inferSelect;

export type NewHarvests = typeof harvests.$inferInsert;


export const presets = pgTable('presets', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    meta: jsonb('meta').default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Presets = typeof presets.$inferSelect;

export type NewPresets = typeof presets.$inferInsert;


export const queues = pgTable('queues', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    size: integer('size'),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Queues = typeof queues.$inferSelect;

export type NewQueues = typeof queues.$inferInsert;


export const scenarios = pgTable('scenarios', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    topic: text('topic').notNull(),
    duration_sec: integer('duration_sec').notNull(),
    tags: jsonb('tags').notNull().default('[]'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Scenarios = typeof scenarios.$inferSelect;

export type NewScenarios = typeof scenarios.$inferInsert;


export const templates = pgTable('templates', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    meta: jsonb('meta').default('{}'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Templates = typeof templates.$inferSelect;

export type NewTemplates = typeof templates.$inferInsert;


export const workers = pgTable('workers', {
    id: uuid('id').notNull().defaultRandom().primaryKey(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


export type Workers = typeof workers.$inferSelect;

export type NewWorkers = typeof workers.$inferInsert;
