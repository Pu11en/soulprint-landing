import pino from 'pino';

/**
 * Centralized Pino logger configuration
 *
 * Production: JSON structured logs for log aggregation (Vercel, Datadog, etc.)
 * Development: Pretty-printed colored logs for local debugging
 *
 * Sensitive fields (passwords, tokens, cookies, auth headers) are automatically redacted
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'apiKey',
  'access_token',
  'secret',
];

export const logger = pino({
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label }; // Return level as string label, not number
    },
  },
  redact: {
    paths: redactPaths,
    remove: true, // Completely remove sensitive fields
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Create a child logger with a specific context
 *
 * Usage:
 *   const log = createLogger('API:Chat');
 *   log.info({ userId: '123', duration: 45 }, 'Request completed');
 *
 * @param context - Context identifier (e.g., 'API:Chat', 'ErrorHandler')
 * @returns Child logger instance with context
 */
export function createLogger(context: string) {
  return logger.child({ context });
}
