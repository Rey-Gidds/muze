/**
 * Singleflight Lock (Cache Stampede Protector)
 * ---------------------------------------------
 * Deduplicates in-flight concurrent requests for the exact same resource.
 * If 100 requests arrive simultaneously on a cache miss, only the first request
 * hits the database while the remaining 99 await the single shared promise.
 */

import { logger } from '../utils/logger.js';

class StampedeLock {
  constructor() {
    this.inFlight = new Map();
  }

  /**
   * Executes or shares a promise for the provided key.
   *
   * @param {string} key Unique request/query key
   * @param {Function} fetcher Async function retrieving data from primary source
   * @returns {Promise<any>}
   */
  async execute(key, fetcher) {
    if (this.inFlight.has(key)) {
      logger.debug(`[StampedeLock] Collapsing duplicate in-flight query for key: ${key}`);
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const stampedeLock = new StampedeLock();
