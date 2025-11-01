/**
 * Test script to demonstrate retry mechanism
 * This script simulates API failures to show retry behavior
 */

import { createLogger } from '@aec/logger';
import { retryFetch } from './utils/retry';

const logger = createLogger({ name: 'retry-test' });

// Simulated API that fails the first 2 times, then succeeds
let attemptCount = 0;

async function simulateUnstableAPI(): Promise<{ success: boolean; data: string }> {
  attemptCount++;

  logger.info({ attemptCount }, 'Simulated API called');

  if (attemptCount < 3) {
    // Simulate 503 Service Unavailable error
    throw new Error('HTTP 503: Service Temporarily Unavailable');
  }

  return {
    success: true,
    data: 'Success after retries!',
  };
}

async function testRetryMechanism() {
  logger.info('Starting retry mechanism test');
  logger.info('This API will fail 2 times, then succeed on the 3rd attempt');

  try {
    const result = await retryFetch(
      simulateUnstableAPI,
      logger,
      { retries: 3 }
    );

    logger.info({ result }, 'Test completed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Test failed after all retries');
  }
}

// Run the test
testRetryMechanism().then(() => {
  logger.info('Test script finished');
  process.exit(0);
}).catch((error) => {
  logger.fatal({ err: error }, 'Test script crashed');
  process.exit(1);
});
