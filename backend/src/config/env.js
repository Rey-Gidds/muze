/**
 * Environment Variables Validator & Config Loader
 * ------------------------------------------------
 * Loads environment variables from the nearest available .env file,
 * verifies required parameters, and exposes a clean typed configuration object.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search hierarchy for .env: backend directory -> parent muze directory -> root project directory
const candidateEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

let loadedEnvPath = null;
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedEnvPath = envPath;
    break;
  }
}

if (!loadedEnvPath) {
  dotenv.config(); // fallback to default process.cwd()
}

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Dedicated Songs Database (holds non-statistical song metadata)
  MONGODB_URI_SONGS: process.env.MONGODB_URI_SONGS || process.env.MONGODB_URI || 'mongodb://localhost:27017/muze-songs',
  MONGODB_DB_NAME_SONGS: process.env.MONGODB_DB_NAME_SONGS || 'muze-songs',

  // Cache (Server Memory LRU Cache capped at 10,000 items)
  CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '10000', 10),

  // Object Storage (Cloudflare R2 / S3)
  BUCKET_URL: process.env.BUCKET_URL || '',
  S3_API: process.env.S3_API || '',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'chat-media',
  USEARCH_INDEX_FILE_NAME: process.env.USEARCH_INDEX_FILE_NAME || 'tracks_index.usearch',
  VECTOR_BIN_FILE_NAME: "vectors_bin_file",
  TRACK_IDS_BIN_FILE_NAME: "track_ids_bin_file",
  SCALER_FILE_NAME: process.env.SCALER_FILE_NAME || 'scaler.joblib',

  // Local file fallbacks if running locally with files in workspace
  LOCAL_INDEX_PATH: path.resolve(__dirname, '../../../../tracks_index.usearch'),
  LOCAL_MAPPING_PATH: path.resolve(__dirname, '../../../../tracks_mapping.parquet'),
  LOCAL_SCALER_PATH: path.resolve(__dirname, '../../../../scaler.joblib'),
};
