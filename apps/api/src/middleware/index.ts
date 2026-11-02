import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { verifyAccessToken, type AccessClaims } from '../services/auth.service';
import { AppError } from '../utils/errors';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AccessClaims;
  }
}

/* ----------------------------- Validation ---------------------------- */
/**
 * Validates and coerces request parts with Zod. Parsed values replace the raw ones,
 * so handlers only ever see clean, typed data. Unknown body keys are stripped.
 */
export function validate(schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      if (schemas.query) Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query), writable: true });
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}
export type Validated<T extends ZodTypeAny> = z.infer<T>;

/* --------------------------- Authentication -------------------------- */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: AccessClaims['role'][]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this'));
    next();
  };

/* ---------------------------- Rate limiting -------------------------- */
// In-memory store: correct for a single API instance. With several instances, plug in a Redis store
// (e.g. rate-limit-redis) so all instances share counters.
const tooMany = (_req: Request, res: Response) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } });

export const apiRateLimit = rateLimit({ windowMs: 60_000, limit: env.RATE_LIMIT_PER_MINUTE, standardHeaders: 'draft-7', legacyHeaders: false, handler: tooMany });
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.LOGIN_RATE_LIMIT_PER_15_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooMany,
});

/* ------------------------------ Caching ------------------------------ */
/**
 * Public content changes rarely, so browsers/CDNs may cache it briefly.
 * Invalidation is time-based: an admin edit becomes visible within `maxAge` seconds
 * (stale copies may be served up to `swr` more seconds while revalidating).
 */
export const publicCache =
  (maxAge = 60, swr = 300): RequestHandler =>
  (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
    next();
  };
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

/* --------------------------- Error handling -------------------------- */
export const notFoundHandler: RequestHandler = (req, _res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`));

/** Central error handler: every error becomes { error: { code, message, details?, requestId } }. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next: NextFunction) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.flatten().fieldErrors;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (err?.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = `A record with this ${Object.keys(err.keyValue ?? {}).join(', ') || 'value'} already exists`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid id';
  }

  if (status >= 500) (req.log ?? logger).error({ err }, 'Unhandled error');
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: req.id } });
};
