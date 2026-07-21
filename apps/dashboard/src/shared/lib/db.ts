/**
 * Database client for Next.js dashboard
 * Ensures single pooled connection with hot reload support
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getDrizzleClient, schema } from '@scrimspec/db';

// Export singleton instance
// NOTE:
// `@scrimspec/db` currently builds the Drizzle schema object dynamically (filters tables via Object.fromEntries),
// which causes TypeScript to lose the concrete schema type and collapses `db.query` to `{}` in consumers.
// Local cast here restores table-aware typing for `db.query.*` and strongly-typed `orderBy`.
export const db = getDrizzleClient() as unknown as NodePgDatabase<typeof schema>;
