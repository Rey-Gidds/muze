/**
 * Global Error Handler Middleware
 * --------------------------------
 * Intercepts uncaught exceptions and rejected promises, logging detailed traces
 * while returning clean, standardized JSON error responses to the client.
 */

import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const message = err.message || 'Internal Server Error';

  logger.error(`[ErrorHandler] ${req.method} ${req.originalUrl} failed with status ${statusCode}:`, {
    error: message,
    stack: env.isProduction ? undefined : err.stack,
  });

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

