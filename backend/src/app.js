/**
 * Express Application Setup
 * -------------------------
 * Configures middleware, security policies, routes, and centralized error handling.
 */

import express from 'express';
import cors from 'cors';
import { requestLogger } from './middlewares/requestLogger.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

import searchRoutes from './routes/search.routes.js';
import recommendRoutes from './routes/recommend.routes.js';
import healthRoutes from './routes/health.routes.js';

export function createApp() {
  const app = express();

  // Basic security and parsing
  app.set('trust proxy', 1); // Respect reverse proxy (e.g. Render, Cloudflare)
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging and rate limiting
  app.use(requestLogger);
  app.use(generalLimiter);

  // Mount API endpoints
  app.use('/search', searchRoutes);
  app.use('/recommend', recommendRoutes);
  app.use('/health', healthRoutes);

  // Fallback 404 and Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}


