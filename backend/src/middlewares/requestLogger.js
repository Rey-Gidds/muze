/**
 * Request Logging Middleware
 * --------------------------
 * Logs method, route, status code, and latency in a crisp, readable format.
 */

import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMethod = res.statusCode >= 500 ? logger.error : res.statusCode >= 400 ? logger.warn : logger.info;
    logMethod(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}

