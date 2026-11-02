/**
 * Server Entrypoint
 * -----------------
 * Bootstraps the application:
 * 1. Connects to MongoDB Atlas via Mongoose
 * 2. Loads usearch vector index into server memory
 * 3. Starts HTTP listener
 * 4. Manages graceful shutdown
 */

import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './database/connection.js';
import { vectorIndexManager } from './storage/indexLoader.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('==================================================');
  logger.info(`Starting Muze Backend Service [env=${env.NODE_ENV}]`);
  logger.info('==================================================');

  // 1. Connect to MongoDB Atlas via Mongoose
  await connectDB();

  // 2. Initialize in-memory usearch vector index
  try {
    await vectorIndexManager.initialize();
  } catch (err) {
    logger.warn('[Bootstrap] Vector index could not be loaded immediately:', { error: err.message });
    logger.warn('[Bootstrap] Recommendation endpoint may return degraded responses until index file is available.');
  }

  // 3. Start Express server
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server successfully listening on port ${env.PORT}`);
    logger.info(`Ready to serve: GET /search | POST /recommend | GET /health`);
  });

  // 4. Graceful shutdown handler
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      logger.info('Graceful shutdown complete. Exiting process.');
      process.exit(0);
    });

    // Force shutdown after 10s timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error:', { error: err.stack || err.message });
  process.exit(1);
});

