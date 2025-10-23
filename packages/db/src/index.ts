/**
 * Scrimspec Database Layer
 * Drizzle ORM for PostgreSQL + Supabase integration
 */

export {
  getDrizzleClient,
  getPgClient,
  getSupabaseClient,
  type DB,
  schema,
} from './client';

export * from './schema';
export * from './queries';
