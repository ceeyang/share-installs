/**
 * @fileoverview Centralized error handling middleware.
 *
 * Error responses follow the Google API Design Guide format:
 *   https://cloud.google.com/apis/design/errors
 *
 * Shape:
 *   {
 *     "error": {
 *       "code":    <HTTP status code>,
 *       "status":  <gRPC status name>,
 *       "message": <human-readable message>
 *     }
 *   }
 */

import {Request, Response, NextFunction} from 'express';
import {logger} from '../utils/logger';

/** Map of HTTP status codes to Google API status names. */
const HTTP_STATUS_MAP: Record<number, string> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'ALREADY_EXISTS',
  410: 'FAILED_PRECONDITION',
  422: 'INVALID_ARGUMENT',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
  503: 'UNAVAILABLE',
};

/** Application-level error with an HTTP status code and a machine-readable status string. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;

  constructor(statusCode: number, message: string, status?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = status ?? HTTP_STATUS_MAP[statusCode] ?? 'INTERNAL';
  }
}

/** Builds a Google-style error response body. */
function buildErrorBody(code: number, status: string, message: string) {
  return {error: {code, status, message}};
}

/** Express error handling middleware – must be registered last. */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(buildErrorBody(err.statusCode, err.status, err.message));
    return;
  }

  // Prisma known request errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as {code: string};
    if (prismaError.code === 'P2002') {
      res.status(409).json(buildErrorBody(409, 'ALREADY_EXISTS', 'Resource already exists.'));
      return;
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json(buildErrorBody(404, 'NOT_FOUND', 'Resource not found.'));
      return;
    }
  }

  logger.error({err, path: req.path, method: req.method}, 'Unhandled error');
  res
    .status(500)
    .json(buildErrorBody(500, 'INTERNAL', 'An unexpected error occurred.'));
}

/** Handles 404 for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(buildErrorBody(404, 'NOT_FOUND', `Cannot ${req.method} ${req.path}`));
}
