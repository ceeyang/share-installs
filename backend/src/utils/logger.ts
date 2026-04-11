/**
 * @fileoverview Structured logger using Pino.
 * Follows Google's logging best practices with structured JSON output.
 */

import pino from 'pino';
import {config} from '../config/index';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: 'invite-backend',
    version: process.env.npm_package_version ?? '0.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return {severity: label.toUpperCase()};
    },
  },
  redact: {
    paths: ['req.headers.authorization', '*.apiSecret', '*.password'],
    censor: '[REDACTED]',
  },
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {colorize: true, translateTime: 'SYS:standard'},
    },
  }),
});
