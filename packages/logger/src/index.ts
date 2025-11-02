import pino from 'pino';

/**
 * Configuration options for creating a logger instance
 */
export interface LoggerOptions {
  /**
   * Name of the service/component using the logger
   */
  name: string;

  /**
   * Minimum log level to output
   * @default 'info' in production, 'debug' in development
   */
  level?: pino.LevelWithSilent;

  /**
   * Additional context fields to include in all log entries
   */
  context?: Record<string, unknown>;
}

/**
 * Creates a configured pino logger instance
 *
 * In development: Uses pino-pretty for human-readable colored output
 * In production: Uses JSON format for machine parsing
 *
 * @param options - Logger configuration options
 * @returns Configured pino logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger({ name: 'ingest-worker' });
 * logger.info({ videoId: '123' }, 'Processing video');
 * logger.error({ err, videoId: '123' }, 'Failed to process video');
 * ```
 */
export function createLogger(options: LoggerOptions): pino.Logger {
  const { name, level, context = {} } = options;

  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Base configuration
  const config: pino.LoggerOptions = {
    name,
    level: level ?? (isDevelopment ? 'debug' : 'info'),

    // Include these fields in every log entry
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
      ...context,
    },

    // Serialize errors properly
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },

    // Add timestamp to all logs
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // In development with a TTY (terminal), use pretty printing
  // In Next.js server-side or non-TTY environments, use JSON even in dev
  const usePretty = isDevelopment && process.stdout.isTTY;

  if (usePretty) {
    return pino(
      config,
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{name} [{levelLabel}]: {msg}',
        },
      })
    );
  }

  // In production or non-TTY environments, use JSON format
  return pino(config);
}

/**
 * Export pino types for convenience
 */
export type Logger = pino.Logger;
export type { LevelWithSilent as LogLevel } from 'pino';

/**
 * Default logger instance for quick use
 * Prefer creating named loggers with createLogger() for better context
 */
export const logger = createLogger({ name: 'default' });
