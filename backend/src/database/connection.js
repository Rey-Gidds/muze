/**
 * Mongoose Database Connection Manager
 * ------------------------------------
 * Connects exclusively to the Muze Songs Database.
 * The Vector Database has been replaced by the local in-memory
 * vector mapping and search engine.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export let songsConnection = null;

const connectionOptions = {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export async function connectDB() {
  logger.info('[Database] Initializing Songs Database connection...');

  try {
    logger.info('[Database] Connecting to Muze Songs Database...');
    songsConnection = mongoose.createConnection(env.MONGODB_URI_SONGS, {
      ...connectionOptions,
      dbName: env.MONGODB_DB_NAME_SONGS,
    });

    songsConnection.on('connected', () => {
      logger.info(`[Database] Connected to Songs DB: ${songsConnection.host}/${songsConnection.name}`);
    });

    songsConnection.on('error', (err) => {
      logger.error('[Database] Songs DB connection error:', { error: err.message });
    });

    await songsConnection.asPromise();
  } catch (err) {
    logger.error('[Database] Failed to connect to Songs DB:', {
      message: err.message,
      hint: 'Verify MONGODB_URI_SONGS and check IP whitelist in MongoDB Atlas.',
    });
  }

  return { songsConnection };
}

export async function disconnectDB() {
  const promises = [];
  if (songsConnection) {
    promises.push(songsConnection.close());
    songsConnection = null;
  }
  await Promise.all(promises);
  logger.info('[Database] Disconnected from Songs database.');
}

export function isDBConnected() {
  return Boolean(songsConnection && songsConnection.readyState === 1);
}
