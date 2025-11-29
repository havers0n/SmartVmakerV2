/**
 * ANALYSIS WORKER - HWAR CORE EDITION
 * 
 * This worker uses the centralized @scrimspec/hwar-core package.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// === ANTI-CRASH SHIELD ===
process.on('uncaughtException', (err) => {
  const msg = String(err);
  if (msg.includes('ECONNRESET') || msg.includes('Connection terminated') || msg.includes('57P01')) {
    console.warn('[System] DB Connection glitch intercepted. Staying alive.');
    return;
  }
  console.error('[System] CRITICAL UNCAUGHT ERROR:', err);
  process.exit(1);
});

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { getDrizzleClient } from '@scrimspec/db';
import { createHwarCore, DefaultAiRouter } from '@scrimspec/hwar-core';

const logger = createLogger({ name: 'analysis-worker' });

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized (Core Mode)');

if (process.env.DRIZZLE_DATABASE_URL) {
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, '');
  }
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
}

async function main() {
  logger.info('Starting Analysis Worker (HWAR Core)...');

  const db = getDrizzleClient();

  const aiRouter = new DefaultAiRouter({
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
  });

  const core = createHwarCore({
    db,
    logger,
    aiRouter,
    storage: {} // Placeholder
  });

  while (true) {
    try {
      // Run a tick of the analysis subsystem
      // This will fetch one pending job, process it, and mark it completed/failed
      await core.analysis.runTick();

      // Small delay to prevent tight loop if queue is empty
      // Ideally runTick returns whether it did work, but for now we just sleep
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.fatal({ err: error }, 'CRITICAL WORKER CRASH. Restarting loop in 30s...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// Signal handlers
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the worker (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    logger.fatal({ err: error }, 'Fatal error');
    process.exit(1);
  });
}