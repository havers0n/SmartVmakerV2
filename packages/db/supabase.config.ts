/**
 * Supabase Configuration for Type Generation
 * 
 * This configuration file defines how to connect to Supabase
 * and generate types from the database schema.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenvConfig({ path: resolve(__dirname, '../../.env') });

export interface SupabaseConfig {
  projectRef: string;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  accessToken: string;
  schema: string;
  outputDir: string;
}

export const supabaseConfig: SupabaseConfig = {
  projectRef: process.env.SUPABASE_PROJECT_REF || 'axgtvvcimqoyxbfvdrok',
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  accessToken: process.env.SUPABASE_ACCESS_TOKEN || '',
  schema: 'public',
  outputDir: resolve(__dirname, 'src/generated'),
};

export default supabaseConfig;
