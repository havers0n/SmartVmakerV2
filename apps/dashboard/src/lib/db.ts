/**
 * Database client for Next.js dashboard
 * Ensures single pooled connection with hot reload support
 */

import { getDrizzleClient } from '@scrimspec/db';

// Export singleton instance
export const db = getDrizzleClient();
