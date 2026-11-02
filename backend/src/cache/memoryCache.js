/**
 * Server Memory LRU Cache
 * -----------------------
 * In-memory Least-Recently-Used (LRU) cache capped by item count:
 * - Capped at max_size (default: 10,000 items)
 * - Pure O(1) item access, insertion, and eviction via JavaScript Map
 * - Per-item TTL expiration with lazy & active purging
 * - Hit/miss statistical metrics
 */

import { logger } from '../utils/logger.js';

class MemoryLRUCache {
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
    this.store = new Map(); // JavaScript Map preserves insertion order for LRU eviction
    this.ttls = new Map();   // Key -> expiration timestamp in ms
    this.hits = 0;
    this.misses = 0;

    // Periodic cleanup of expired keys every 60 seconds
    this.cleanupInterval = setInterval(() => this.purgeExpired(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Don't prevent process exit
    }

    logger.info(`[MemoryCache] Initialized In-Memory LRU Cache (capped at ${this.maxSize.toLocaleString()} items)`);
  }

  /**
   * Retrieves an entry from cache.
   * If expired or not found, returns null.
   * Moves entry to most-recently-used position.
   */
  get(key) {
    // Check TTL
    const expireAt = this.ttls.get(key);
    if (expireAt && Date.now() > expireAt) {
      this.del(key);
      this.misses++;
      return null;
    }

    if (!this.store.has(key)) {
      this.misses++;
      return null;
    }

    this.hits++;
    const value = this.store.get(key);

    // Refresh LRU order by deleting and re-inserting
    this.store.delete(key);
    this.store.set(key, value);

    return value;
  }

  /**
   * Stores an entry with optional TTL in seconds.
   * Evicts the oldest item if item count reaches maxSize.
   */
  set(key, value, ttlSeconds = 3600) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict least-recently-used entry (first key in Map iterator)
      const oldestKey = this.store.keys().next().value;
      this.del(oldestKey);
      logger.debug(`[MemoryCache] Evicted LRU key: ${oldestKey} to maintain ${this.maxSize} item cap`);
    }

    this.store.set(key, value);

    if (ttlSeconds && ttlSeconds > 0) {
      this.ttls.set(key, Date.now() + ttlSeconds * 1000);
    }
  }

  /**
   * Deletes a specific key.
   */
  del(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }

  /**
   * Cleans up expired items.
   */
  purgeExpired() {
    const now = Date.now();
    for (const [key, expireAt] of this.ttls.entries()) {
      if (now > expireAt) {
        this.del(key);
      }
    }
  }

  /**
   * Clears the entire cache.
   */
  clear() {
    this.store.clear();
    this.ttls.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Returns cache metrics and current size stats.
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(1) + '%' : '0%';
    return {
      type: 'in-memory-lru',
      itemCount: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}

export const memoryCache = new MemoryLRUCache(10000);
