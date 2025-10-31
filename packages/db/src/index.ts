/**
 * Scrimspec Database Layer
 * Drizzle ORM for PostgreSQL + Supabase integration
 */

export {
  getDrizzleClient,
  getPgClient,
  getSupabaseClient,
  type DB,
} from './client';

// Re-export all schemas from the new unified schema file
export * from '../migrations/schema';

// Export the schema object for convenience
export { schema } from './client';


