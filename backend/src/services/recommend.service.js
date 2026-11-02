/**
 * Recommendation Service
 * ----------------------
 * End-to-end recommendation pipeline:
 * 1. Resolves target track_id to its 17-dim vector using in-memory VectorMappingStore (0ms network)
 * 2. Queries in-memory usearch index for nearest neighbors (<1ms ML retrieval layer)
 * 3. Resolves candidate track_ids instantly from in-memory mapping
 * 4. Batches resolution of non-statistical metadata from Songs DB (single cluster query)
 * 5. Passes precomputed distances/similarity directly to FAI Agent
 * 6. Returns final set of non-statistical song details (duration included)
 */

import { Song } from '../database/models/song.model.js';
import { vectorIndexManager } from '../storage/indexLoader.js';
import { vectorMappingStore } from '../storage/vectorMappingStore.js';
import { cacheManager } from '../cache/cacheManager.js';
import { faiService } from './fai.service.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export const recommendService = {
  /**
   * Retrieves the 17-dimensional vector for a given track_id instantly from memory.
   *
   * @param {string} trackId Unique Spotify track ID
   * @returns {Float32Array|null}
   */
  getTrackVector(trackId) {
    return vectorMappingStore.getVectorByTrackId(trackId);
  },

  /**
   * Resolves a list of track IDs to non-statistical song metadata in batch.
   *
   * @param {Array<string>} trackIds
   * @returns {Promise<Map<string, Object>>}
   */
  async batchGetSongMetadata(trackIds) {
    const startTime = Date.now();
    const metadataMap = new Map();
    const missingTrackIds = [];

    // 1. Check server memory cache for each track
    for (const tid of trackIds) {
      const cacheKey = `${CONSTANTS.CACHE_PREFIX.TRACK_META}${tid}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        metadataMap.set(tid, cached);
      } else {
        missingTrackIds.push(tid);
      }
    }

    // 2. Batch query Songs DB for any cache misses
    if (missingTrackIds.length > 0) {
      logger.debug(`[RecommendService] Batch fetching metadata for ${missingTrackIds.length} tracks from Songs DB.`);
      const songs = await Song.find(
        {
          $or: [
            { track_id: { $in: missingTrackIds } },
            { id: { $in: missingTrackIds } },
          ],
        },
        {
          track_id: 1,
          name: 1,
          album: 1,
          artists: 1,
          duration_ms: 1,
          year: 1,
          release_date: 1,
          explicit: 1,
          _id: 0,
        }
      ).lean();

      for (const song of songs) {
        const tid = song.track_id || song.id;
        const formatted = {
          track_id: tid,
          name: song.name,
          album: song.album || 'Unknown Album',
          artists: Array.isArray(song.artists) ? song.artists : [song.artists || 'Unknown Artist'],
          duration_ms: song.duration_ms,
          year: song.year || null,
          release_date: song.release_date || '',
          explicit: Boolean(song.explicit),
        };

        metadataMap.set(tid, formatted);
        cacheManager.set(`${CONSTANTS.CACHE_PREFIX.TRACK_META}${tid}`, formatted, CONSTANTS.METADATA_TTL_SECONDS);
      }
    }
    const endTime = Date.now();
    logger.info(`[RecommendService] Fetched ${metadataMap.size} songs metadata in ${endTime - startTime}ms`);
    return metadataMap;
  },

  /**
   * Generates recommendations for a chosen track ID using the ML + FAI pipeline.
   *
   * @param {string} trackId Target seed track identifier
   * @param {number} topK Number of recommendations requested (default 20, max 100)
   * @returns {Promise<Array<Object>>} Final set of recommended songs with non-statistical details
   */
  async getRecommendations(trackId, topK = CONSTANTS.DEFAULT_TOP_K) {
    const startTime = Date.now();
    if (!trackId || typeof trackId !== 'string') {
      const err = new Error('A valid track_id string is required.');
      err.statusCode = 400;
      throw err;
    }

    const clampedTopK = Math.min(Math.max(parseInt(topK, 10) || CONSTANTS.DEFAULT_TOP_K, 1), CONSTANTS.MAX_TOP_K);

    // Step 1: Retrieve seed track vector instantly from memory
    const targetVector = this.getTrackVector(trackId);
    if (!targetVector) {
      const err = new Error(`Track with ID '${trackId}' not found in vector index mapping.`);
      err.statusCode = 404;
      throw err;
    }

    // Step 2: ML Layer (usearch ANN search in <1ms)
    // Retrieve a candidate pool of 120-150 candidates for the FAI agent to filter
    const candidatePoolSize = Math.max(clampedTopK * 4, 120);
    const rawMatches = vectorIndexManager.search(targetVector, candidatePoolSize + 1);

    // Step 3: Resolve vectorIds to track_ids instantly in-memory (0ms network)
    const candidateTrackIds = [];
    const validMatches = [];
    for (const match of rawMatches) {
      const tid = vectorMappingStore.getTrackId(match.vectorId);
      if (tid && tid !== trackId) {
        candidateTrackIds.push(tid);
        validMatches.push({ ...match, track_id: tid });
      }
    }

    // Step 4: Batch resolve candidate metadata from Songs DB (single cluster query)
    const metadataMap = await this.batchGetSongMetadata(candidateTrackIds);

    // Step 5: Format candidate pool for FAI Agent (precomputed distance & similarity directly attached)
    const faiCandidates = [];
    for (const match of validMatches) {
      const meta = metadataMap.get(match.track_id);
      const artist = meta && meta.artists && meta.artists.length > 0 ? meta.artists[0] : 'Unknown Artist';
      const title = meta && meta.name ? meta.name : 'Unknown Title';

      faiCandidates.push({
        track_id: match.track_id,
        vector_id: match.vectorId,
        distance: match.distance,
        similarity: Number((1.0 - match.distance).toFixed(6)),
        title,
        artist,
      });
    }

    // Step 6: Invoke Python FAI Goal-Based Agent for CSP filtering and diversity optimization
    logger.info(`[RecommendService] Passing ${faiCandidates.length} ML candidates to FAI Agent (target: ${clampedTopK})...`);
    const faiSelected = await faiService.filterWithFAIAgent(trackId, faiCandidates, clampedTopK);

    // Step 7: Format non-statistical response for client (duration_ms included)
    const recommendations = [];
    for (const selected of faiSelected) {
      const meta = metadataMap.get(selected.track_id);
      if (meta) {
        recommendations.push({
          track_id: meta.track_id,
          name: meta.name,
          artists: meta.artists,
          album: meta.album,
          duration_ms: meta.duration_ms, // Explicit requirement: non-statistical duration must be included
          release_date: meta.release_date,
          year: meta.year,
          explicit: meta.explicit,
          similarity_score: Number(selected.similarity ? selected.similarity.toFixed(4) : (1.0 - (selected.distance || 0)).toFixed(4)),
        });
      }
    }
    const endTime = Date.now();
    logger.info(`[RecommendService] Generated ${recommendations.length} recommendations by ML pipeline in ${endTime - startTime}ms`);
    return recommendations;
  },
};
