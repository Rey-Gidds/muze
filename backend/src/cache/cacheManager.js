/**
 * Keep-Aside Cache Manager
 * ------------------------
 * High-level keep-aside cache orchestration combining:
 * 1. Server in-memory LRU cache (capped at 256MB threshold)
 * 2. Singleflight lock deduplication (cache stampede / thundering herd protection)
 * 3. Random TTL jitter to prevent synchronized expiration
 */

import { memoryCache } from './memoryCache.js';
import { stampedeLock } from './stampedeLock.js';
import { getJitteredTtl } from '../utils/jitter.js';
import { logger } from '../utils/logger.js';
import { CONSTANTS } from '../config/constants.js';

export const cacheManager = {
  /**
   * Retrieves an item from cache, or fetches from primary DB (via fetcher)
   * and caches it in server memory with a jittered TTL.
   *
   * @param {string} key Cache key
   * @param {Function} fetcher Async fallback function to call on cache miss
   * @param {number} baseTtlSeconds Base TTL in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetcher, baseTtlSeconds = CONSTANTS.DEFAULT_TTL_SECONDS) {
    // 1. Check memory cache first
    const cached = memoryCache.get(key);
    if (cached !== null && cached !== undefined) {
      logger.debug(`[Cache] HIT for key: ${key}`);
      return cached;
    }

    logger.debug(`[Cache] MISS for key: ${key}`);

    // 2. Lock deduplication to avoid DB thundering herds
    return stampedeLock.execute(key, async () => {
      // Re-check cache in case a concurrent request just resolved and populated it
      const doubleCheck = memoryCache.get(key);
      if (doubleCheck !== null && doubleCheck !== undefined) {
        return doubleCheck;
      }

      // 3. Fetch from primary database
      const freshData = await fetcher();

      // 4. Cache data with jittered TTL if found
      if (freshData !== null && freshData !== undefined) {
        const jitteredTtl = getJitteredTtl(baseTtlSeconds);
        memoryCache.set(key, freshData, jitteredTtl);
      }

      return freshData;
    });
  },

  get(key) {
    return memoryCache.get(key);
  },

  set(key, value, baseTtlSeconds = CONSTANTS.DEFAULT_TTL_SECONDS) {
    const jitteredTtl = getJitteredTtl(baseTtlSeconds);
    return memoryCache.set(key, value, jitteredTtl);
  },

  del(key) {
    return memoryCache.del(key);
  },

  getStats() {
    return memoryCache.getStats();
  }
};
