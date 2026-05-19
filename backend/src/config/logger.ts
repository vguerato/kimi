/**
 * logger — Application-wide Pino logger.
 *
 * Usage:
 *   import { logger } from '../config/logger';
 *   logger.info('Server started');
 *   logger.error({ err }, 'Something failed');
 *
 * Child loggers (scoped to a module):
 *   const log = logger.child({ module: 'JiraService' });
 *   log.warn('Credential validation failed');
 *
 * In development (NODE_ENV !== 'production') logs are pretty-printed via
 * pino-pretty. In production they are emitted as structured JSON to stdout,
 * ready for log aggregators (CloudWatch, Datadog, etc.).
 */

import pino, { Logger } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',

  // Pretty-print in development; structured JSON in production
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize:        true,
          translateTime:   'SYS:HH:MM:ss.l',
          ignore:          'pid,hostname',
          messageFormat:   '{msg}',
          singleLine:      false,
        },
      }
    : undefined,

  // Base fields added to every log line
  base: { service: 'shift-backend' },

  // Redact sensitive fields from structured logs
  redact: {
    paths:  ['*.token', '*.apiKey', '*.pat', '*.password', '*.secret'],
    censor: '[REDACTED]',
  },
});
