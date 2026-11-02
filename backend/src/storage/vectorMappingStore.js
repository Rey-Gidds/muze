/**
 * In-Memory Vector and Track ID Mapping Store
 * -------------------------------------------
 * Completely local, zero-network, sub-millisecond retrieval of:
 * 1. track_id -> vector_id & 17-dimensional vector
 * 2. vector_id -> track_id
 *
 * Eliminates the remote Vector MongoDB Atlas cluster entirely.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { CONSTANTS } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ID_LENGTH = 22; // Standard Spotify 22-character base62 ID
const DIMENSIONS = CONSTANTS.VECTOR_DIMENSION; // 17

class VectorMappingStore {
  constructor() {
    this.isLoaded = false;
    this.totalCount = 0;
    this.trackIdsBuffer = null;
    this.vectorsArray = null;
    this.trackToIdMap = new Map();
  }

  /**
   * Loads track_ids.bin and vectors.bin into memory
   */
  async initialize() {
    if (this.isLoaded) return;

    const dataDir = path.resolve(__dirname, '../../data');
    const trackIdsPath = path.join(dataDir, 'track_ids.bin');
    const vectorsPath = path.join(dataDir, 'vectors.bin');

    if (!fs.existsSync(trackIdsPath) || !fs.existsSync(vectorsPath)) {
      throw new Error(`Mapping files not found in ${dataDir}. Ensure track_ids.bin and vectors.bin exist.`);
    }

    logger.info('[VectorMappingStore] Loading track IDs and feature vectors into memory...');
    const startTime = Date.now();

    // 1. Read track IDs buffer
    this.trackIdsBuffer = fs.readFileSync(trackIdsPath);
    this.totalCount = Math.floor(this.trackIdsBuffer.length / ID_LENGTH);

    // 2. Read vectors binary into flat Float32Array
    const vBuf = fs.readFileSync(vectorsPath);
    this.vectorsArray = new Float32Array(vBuf.buffer, vBuf.byteOffset, vBuf.byteLength / 4);

    // 3. Build reverse track_id -> vector_id Map for instantaneous O(1) seed lookups
    for (let vid = 0; vid < this.totalCount; vid++) {
      const offset = vid * ID_LENGTH;
      const tid = this.trackIdsBuffer.toString('ascii', offset, offset + ID_LENGTH);
      this.trackToIdMap.set(tid, vid);
    }

    this.isLoaded = true;
    const duration = Date.now() - startTime;
    logger.info(`[VectorMappingStore] Loaded ${this.totalCount.toLocaleString()} track IDs & vectors in ${duration}ms (0ms network overhead).`);
  }

  /**
   * Resolves a Spotify track_id string to its vector_id
   * @param {string} trackId 
   * @returns {number|null}
   */
  getVectorId(trackId) {
    const id = this.trackToIdMap.get(trackId);
    return id !== undefined ? id : null;
  }

  /**
   * Resolves a vector_id (0..N-1) to its Spotify track_id string in O(1) time
   * @param {number} vectorId 
   * @returns {string|null}
   */
  getTrackId(vectorId) {
    if (vectorId < 0 || vectorId >= this.totalCount || !this.trackIdsBuffer) {
      return null;
    }
    const offset = vectorId * ID_LENGTH;
    return this.trackIdsBuffer.toString('ascii', offset, offset + ID_LENGTH);
  }

  /**
   * Retrieves the 17-dimensional Float32Array vector for a given vector_id
   * @param {number} vectorId 
   * @returns {Float32Array|null}
   */
  getVectorByVectorId(vectorId) {
    if (vectorId < 0 || vectorId >= this.totalCount || !this.vectorsArray) {
      return null;
    }
    const offset = vectorId * DIMENSIONS;
    return this.vectorsArray.subarray(offset, offset + DIMENSIONS);
  }

  /**
   * Retrieves the 17-dimensional Float32Array vector for a given track_id
   * @param {string} trackId 
   * @returns {Float32Array|null}
   */
  getVectorByTrackId(trackId) {
    const vid = this.getVectorId(trackId);
    if (vid === null) return null;
    return this.getVectorByVectorId(vid);
  }
}

export const vectorMappingStore = new VectorMappingStore();

