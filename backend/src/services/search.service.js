/**
 * Search Service
 * --------------
 * Handles song lookups by query string:
 * 1. Checks server in-memory LRU cache first
 * 2. On miss, collapses concurrent requests via singleflight lock (stampede protection)
 * 3. Queries MongoDB via Mongoose with text/regex indexes
 * 4. Writes results to cache with random jittered TTL
 * 5. Returns non-statistical track information
 */

import { Song } from '../database/models/song.model.js';
import { cacheManager } from '../cache/cacheManager.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Escapes regex special characters in a user query string.
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Sanitizes and shapes song document for frontend consumption.
 * Only non-statistical fields are included (duration_ms is mandatory).
 */
function formatSongMetadata(song) {
  return {
    track_id: song.track_id || song.id,
    name: song.name,
    album: song.album || 'Unknown Album',
    artists: Array.isArray(song.artists) ? song.artists : [song.artists || 'Unknown Artist'],
    duration_ms: song.duration_ms,
    year: song.year || null,
    release_date: song.release_date || '',
    explicit: Boolean(song.explicit),
  };
}

export const searchService = {
  /**
   * Searches for songs by name/keyword.
   *
   * @param {string} rawQuery User search term
   * @param {number} limit Maximum results to return
   * @returns {Promise<Array<Object>>}
   */
  async searchSongs(rawQuery, limit = 20) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return [];
    }

    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];

    const cacheKey = `${CONSTANTS.CACHE_PREFIX.SEARCH}${query}`;

    // Execute through keep-aside cache with stampede protection & TTL jitter
    return cacheManager.getOrSet(
      cacheKey,
      async () => {
        logger.info(`[SearchService] Cache miss. Querying MongoDB for query: "${query}"`);

        // 1. Primary: Text index search if available
        let results = [];
        try {
          results = await Song.find(
            { $text: { $search: query } },
            { score: { $meta: 'textScore' } }
          )
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .lean();
        } catch {
          // If text index not yet built on Atlas, fallback cleanly to regex
          results = [];
        }

        // 2. Secondary: Case-insensitive prefix/substring regex match
        if (!results || results.length === 0) {
          const escaped = escapeRegex(query);
          results = await Song.find({
            name: { $regex: escaped, $options: 'i' },
          })
            .limit(limit)
            .lean();
        }

        const formatted = results.map(formatSongMetadata);

        // Pre-populate individual track caches for subsequent instant recommendation lookups
        for (const item of formatted) {
          const trackKey = `${CONSTANTS.CACHE_PREFIX.TRACK_META}${item.track_id}`;
          cacheManager.set(trackKey, item, CONSTANTS.METADATA_TTL_SECONDS);
        }

        return formatted;
      },
      CONSTANTS.SEARCH_TTL_SECONDS
    );
  },
};

