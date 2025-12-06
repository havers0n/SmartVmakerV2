import pRetry, { AbortError, type Options } from 'p-retry';
import { type Logger } from '@aec/logger';

/**
 * Configuration options for retry mechanism
 */
export interface RetryOptions {
    /**
     * Number of retry attempts (default: 3)
     */
    retries?: number;

    /**
     * Factor for exponential backoff (default: 2)
     */
    factor?: number;

    /**
     * Minimum delay between retries in ms (default: 1000)
     */
    minTimeout?: number;

    /**
     * Maximum delay between retries in ms (default: 10000)
     */
    maxTimeout?: number;

    /**
     * Custom function to determine if error should be retried
     */
    shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry'>> = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
};

/**
 * Determines if an HTTP error should be retried
 * - 5xx errors: Server errors (always retry)
 * - 429: Rate limit (retry)
 * - 408: Request timeout (retry)
 * - Network errors: ECONNRESET, ETIMEDOUT, etc. (retry)
 */
function shouldRetryError(error: Error): boolean {
    // Network errors
    if (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ENETUNREACH') ||
        error.message.includes('fetch failed')
    ) {
        return true;
    }

    // HTTP errors - check if error message contains status code
    const statusMatch = error.message.match(/\b(5\d{2}|429|408)\b/);
    if (statusMatch) {
        return true;
    }

    // Default: don't retry
    return false;
}

/**
 * Wraps a fetch operation with retry logic using exponential backoff
 *
 * @param operation - Async function to retry (typically a fetch call)
 * @param logger - Logger instance for retry attempt logging
 * @param options - Retry configuration options
 * @returns Promise that resolves with the operation result
 *
 * @example
 * ```typescript
 * const response = await retryFetch(
 *   async () => {
 *     const res = await fetch(url);
 *     if (!res.ok) {
 *       throw new Error(`HTTP ${res.status}: ${res.statusText}`);
 *     }
 *     return res.json();
 *   },
 *   logger,
 *   { retries: 3 }
 * );
 * ```
 */
export async function retryFetch<T>(
    operation: () => Promise<T>,
    logger: Logger,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const shouldRetry = options.shouldRetry ?? shouldRetryError;

    const pRetryOptions: Options = {
        retries: config.retries,
        factor: config.factor,
        minTimeout: config.minTimeout,
        maxTimeout: config.maxTimeout,
        onFailedAttempt: (error) => {
            const attemptNumber = error.attemptNumber;
            const retriesLeft = error.retriesLeft;

            if (retriesLeft > 0) {
                logger.warn(
                    {
                        attempt: attemptNumber,
                        retriesLeft,
                        error: error.message,
                        nextRetryDelay: `${Math.min(
                            config.minTimeout * Math.pow(config.factor, attemptNumber - 1),
                            config.maxTimeout
                        )}ms`,
                    },
                    'API call failed, retrying...'
                );
            } else {
                logger.error(
                    {
                        attempt: attemptNumber,
                        error: error.message,
                    },
                    'All retry attempts exhausted'
                );
            }
        },
    };

    return pRetry(async () => {
        try {
            return await operation();
        } catch (error) {
            // Check if error should be retried
            if (error instanceof Error && !shouldRetry(error)) {
                // Abort retry for non-retryable errors (4xx client errors, etc.)
                logger.warn(
                    { error: error.message },
                    'Non-retryable error encountered, aborting retry'
                );
                throw new AbortError(error);
            }
            // Re-throw to trigger retry
            throw error;
        }
    }, pRetryOptions);
}

/**
 * Exponential backoff delay calculator
 * Useful for custom retry implementations
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
    attempt: number,
    options: RetryOptions = {}
): number {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const delay = config.minTimeout * Math.pow(config.factor, attempt - 1);
    return Math.min(delay, config.maxTimeout);
}
