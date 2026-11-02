import pino from 'pino';
import { env, isTest } from '../config/env';

/** Structured JSON logs (one object per line) — easy to ship to Loki, ELK or CloudWatch. */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'sda-api' },
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.passwordHash'], censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
