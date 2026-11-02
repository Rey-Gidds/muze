/**
 * In-Memory Vector Search Index Manager
 * -------------------------------------
 * Loads and retains the compiled usearch index (1.2M vectors, 17 dimensions)
 * in server memory for ultra-fast approximate nearest neighbor (ANN) retrieval.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import usearch from 'usearch';
import { CONSTANTS } from '../config/constants.js';
import { r2Storage } from './r2Storage.js';
import { vectorMappingStore } from './vectorMappingStore.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VectorIndexManager {
  constructor() {
    this.index = null;
    this.isLoaded = false;
    this.vectorCount = 0;
  }

  /**
   * Initializes and loads the usearch index and local mapping store into memory.
   */
  async initialize() {
    if (this.isLoaded) return;

    logger.info('[VectorIndex] Initializing vector search index and mapping store...');
    const localIndexTarget = path.resolve(__dirname, '../../data/tracks_index.usearch');

    try {
      // 1. Initialize local track_ids and vectors fast-loader
      await vectorMappingStore.initialize();

      // 2. Ensure index file is present (download from Cloudflare R2 if missing)
      let indexFilePath = localIndexTarget;
      if (!fs.existsSync(localIndexTarget)) {
        indexFilePath = await r2Storage.ensureIndexFile(localIndexTarget);
      }
      
      this.index = new usearch.Index({
        dimensions: CONSTANTS.VECTOR_DIMENSION,
        metric: 'cos', // Cosine similarity
      });

      logger.info(`[VectorIndex] Loading index from ${indexFilePath} into server memory...`);
      const startTime = Date.now();
      this.index.load(indexFilePath);
      const loadDuration = Date.now() - startTime;

      this.vectorCount = this.index.size();
      this.isLoaded = true;

      logger.info(`[VectorIndex] Successfully loaded ${this.vectorCount.toLocaleString()} vectors in ${loadDuration}ms.`);
    } catch (err) {
      logger.error('[VectorIndex] Failed to initialize vector index:', { error: err.message });
      throw err;
    }
  }

  /**
   * Performs approximate nearest neighbor search.
   *
   * @param {Array<number>|Float32Array} queryVector 17-dimensional vector
   * @param {number} topK Number of nearest neighbors to retrieve
   * @returns {Array<{ vectorId: number, distance: number }>}
   */
  search(queryVector, topK = CONSTANTS.DEFAULT_TOP_K) {
    if (!this.isLoaded || !this.index) {
      throw new Error('Vector index is not initialized or still loading.');
    }

    if (!Array.isArray(queryVector) && !(queryVector instanceof Float32Array)) {
      throw new TypeError('Query vector must be an Array or Float32Array.');
    }

    if (queryVector.length !== CONSTANTS.VECTOR_DIMENSION) {
      throw new Error(`Vector dimension mismatch: expected ${CONSTANTS.VECTOR_DIMENSION}, got ${queryVector.length}`);
    }

    const typedVector = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const matches = this.index.search(typedVector, topK);

    const results = [];
    const keys = matches.keys;
    const distances = matches.distances;

    for (let i = 0; i < keys.length; i++) {
      results.push({
        vectorId: Number(keys[i]),
        distance: Number(distances[i].toFixed(6)),
      });
    }

    return results;
  }

  getStatus() {
    return {
      isLoaded: this.isLoaded,
      vectorCount: this.vectorCount,
      dimensions: CONSTANTS.VECTOR_DIMENSION,
    };
  }
}

export const vectorIndexManager = new VectorIndexManager();
