import { pgTable, text } from 'drizzle-orm/pg-core';

export const schemaMigrations = pgTable('schema_migrations', {
    version: text('version').notNull().primaryKey(),
    statements: text('statements').$type<string[]>(),
    name: text('name'),
    created_by: text('created_by'),
    idempotency_key: text('idempotency_key'),
});


export type SchemaMigrations = typeof schemaMigrations.$inferSelect;

export type NewSchemaMigrations = typeof schemaMigrations.$inferInsert;
