/**
 * Centralized logging utility using pino
 * Replaces all console.log statements throughout the application
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Create logger instance with appropriate configuration for environment
 */
export const logger = pino({
  level: process.env.NEXT_PUBLIC_LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  browser: {
    asObject: true,
    serialize: true,
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Redact sensitive fields to prevent accidental logging of PII/secrets
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'apiKey',
      'api_key',
      'secret',
      'authorization',
      'cookie',
      'email', // Redact email to prevent PII leaks
      'phone', // Redact phone to prevent PII leaks
      '*.password',
      '*.token',
      '*.accessToken',
      '*.access_token',
      '*.email',
      '*.phone',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with additional context
 * @param context - Context object to be included in all log messages
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Type-safe log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Helper to log errors with stack traces
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error(
      {
        ...context,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      },
      error.message
    );
  } else {
    logger.error({ ...context, error }, 'Unknown error occurred');
  }
}

/**
 * Helper to safely log user actions (without PII)
 */
export function logUserAction(action: string, metadata?: Record<string, unknown>) {
  logger.info(
    {
      action,
      ...metadata,
      timestamp: new Date().toISOString(),
    },
    `User action: ${action}`
  );
}

export default logger;
