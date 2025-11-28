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

// Re-export Drizzle ORM utilities for consistent imports
export { sql, eq, and, or, gte, lte, gt, lt, ne, asc, desc, count, sum } from 'drizzle-orm';


