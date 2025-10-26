#!/usr/bin/env node

/**
 * DB-First Type Generation Script for Scrimspec
 * 
 * This script generates TypeScript types directly from the live Supabase database.
 * The database is the single source of truth - we pull types from it, not generate them.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

interface DBFirstConfig {
  outputFile: string;
  projectRef: string;
  schemas: string[];
}

const config: DBFirstConfig = {
  outputFile: resolve(__dirname, '../src/types/database.types.ts'),
  projectRef: process.env.SUPABASE_PROJECT_REF || 'cuwdjemjuszaaxpouprc',
  schemas: ['public', 'jobs', 'studio', 'generation_pipeline', 'aes_core', 'analytics'],
};

/**
 * Pull types from Supabase database
 */
async function pullTypesFromDatabase(): Promise<void> {
  console.log('🚀 Pulling types from Supabase database...');
  console.log(`📊 Project: ${config.projectRef}`);
  console.log(`📋 Schemas: ${config.schemas.join(', ')}`);
  console.log(`📁 Output: ${config.outputFile}`);

  try {
    // Ensure output directory exists
    const outputDir = resolve(config.outputFile, '..');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Build the Supabase CLI command
    const schemaList = config.schemas.join(',');
    const command = `supabase gen types typescript --project-id ${config.projectRef} --schema ${schemaList}`;
    
    console.log(`🔧 Running: ${command}`);

    // Execute the command and capture output
    const typesOutput = execSync(command, { 
      encoding: 'utf8',
      cwd: resolve(__dirname, '../'),
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN || '',
      }
    });

    // Add header comment
    const headerComment = `/**
 * Auto-generated types from Supabase database
 * Generated at: ${new Date().toISOString()}
 * 
 * This file is generated directly from the live Supabase database.
 * The database is the single source of truth.
 * 
 * To regenerate: pnpm types:pull
 */

`;

    // Write the generated types
    const fullContent = headerComment + typesOutput;
    writeFileSync(config.outputFile, fullContent, 'utf8');

    console.log('✅ Types pulled successfully from database!');
    console.log(`📁 Saved to: ${config.outputFile}`);

  } catch (error) {
    console.error('❌ Failed to pull types from database:', error);
    
    // Create a minimal fallback
    const fallbackContent = `/**
 * Fallback types (database connection failed)
 * Generated at: ${new Date().toISOString()}
 * 
 * This is a fallback file created when the database connection failed.
 * Run 'pnpm types:pull' to regenerate from the live database.
 */

export interface Database {
  public: {
    Tables: {
      // Fallback types - run 'pnpm types:pull' to get real types
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}`;

    writeFileSync(config.outputFile, fallbackContent, 'utf8');
    console.log('⚠️  Created fallback types file');
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log('🎯 DB-First Type Generation for Scrimspec');
  console.log('📋 Principle: Database is the single source of truth');
  console.log('');

  // Check for required environment variables
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }

  await pullTypesFromDatabase();
}

// Run if called directly
if (require.main === module) {
  main();
}

export { pullTypesFromDatabase };