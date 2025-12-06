/**
 * KEYFRAME WORKER - THIN ADAPTER
 * 
 * Logic moved to @scrimspec/hwar-core
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
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

// Ensure NODE_ENV is set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { getDrizzleClient } from '@scrimspec/db';
import * as storage from '@aec/storage-client';
import { createHwarCore, DefaultAiRouter } from '@scrimspec/hwar-core';

const logger = createLogger({ name: 'keyframe-worker' });

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized (Adapter Mode)');

if (process.env.DRIZZLE_DATABASE_URL) {
  logger.info('Using DRIZZLE_DATABASE_URL (Pooler)');
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, '');
  }
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
}

async function main() {
  logger.info('Starting Keyframe Worker (HWAR Core Adapter)...');

  const db = getDrizzleClient();

  // Initialize HWAR Core
  const aiRouter = new DefaultAiRouter({
    geminiApiKey: process.env.GEMINI_API_KEY,
    minimaxApiKey: process.env.MINIMAX_API_KEY,
    db,
  });

  const hwar = createHwarCore({
    db,
    logger,
    aiRouter,
    storage
  });

  while (true) {
    try {
      // Run one tick of keyframe processing
      await hwar.keyframes.runTick();

      // Small wait to avoid tight loop if empty, but runTick usually waits on DB or returns empty
      // If runTick returns immediately when empty, we should sleep.
      // The current runTick implementation in hwar-core (via processor) fetches batch.
      // If empty, it returns.
      // So we should sleep if we want to avoid CPU spin.
      // But we don't know if it did work or not easily unless runTick returns count.
      // For now, let's sleep a bit.
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.fatal({ err: error }, 'CRITICAL WORKER CRASH. Restarting loop in 30s...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// Signal handlers
process.on('SIGINT', () => { logger.info('SIGINT received'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('SIGTERM received'); process.exit(0); });

// Start the worker (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    logger.fatal({ err: e }, 'Fatal startup error');
    process.exit(1);
  });
}