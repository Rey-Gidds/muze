/**
 * Cloudflare R2 Storage Service
 * ------------------------------
 * Manages downloading and fetching static ML index artifacts (.usearch / .joblib)
 * from Cloudflare R2 object storage to server memory/disk.
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const r2Storage = {
  /**
   * Ensures the .usearch index file is available locally for usearch in-memory loading.
   * If not already cached locally, streams it from Cloudflare R2.
   *
   * @param {string} destinationPath Local file path where index will be stored
   * @returns {Promise<string>} Path to local available file
   */
  async ensureIndexFile(destinationPath) {
    // 1. If file already exists locally, use it directly (e.g. local dev or pre-downloaded)
    if (fs.existsSync(destinationPath)) {
      const stats = fs.statSync(destinationPath);
      logger.info(`[R2Storage] Using existing local index file at ${destinationPath} (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`);
      return destinationPath;
    }

    // 2. Check if the root workspace has the index file
    if (fs.existsSync(env.LOCAL_INDEX_PATH)) {
      logger.info(`[R2Storage] Found index file in workspace root: ${env.LOCAL_INDEX_PATH}`);
      return env.LOCAL_INDEX_PATH;
    }

    // 3. Download from Cloudflare R2 BUCKET_URL
    const fileUrl = `${env.BUCKET_URL.replace(/\/$/, '')}/${env.USEARCH_INDEX_FILE_NAME}`;
    logger.info(`[R2Storage] Local index file not found. Downloading from R2: ${fileUrl}...`);

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch index file from R2 (${response.status} ${response.statusText}): ${fileUrl}`);
    }

    const fileStream = fs.createWriteStream(destinationPath);
    await pipeline(Readable.fromWeb(response.body), fileStream);

    const stats = fs.statSync(destinationPath);
    logger.info(`[R2Storage] Successfully downloaded index from R2 (${(stats.size / (1024 * 1024)).toFixed(1)} MB) to ${destinationPath}`);
    return destinationPath;
  }
};

