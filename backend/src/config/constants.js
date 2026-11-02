/**
 * Application Constants
 * ---------------------
 * Centralized immutable configuration constants for recommendation parameters,
 * cache key formatting, vector dimensions, and jitter factors.
 */

export const CONSTANTS = {
  // Vector search configurations
  VECTOR_DIMENSION: 17,
  DEFAULT_TOP_K: 20,
  MAX_TOP_K: 50,

  // Cache settings
  CACHE_MAX_SIZE: 10000,           // Capped at 10,000 items in memory
  DEFAULT_TTL_SECONDS: 3600,       // 1 hour standard TTL
  SEARCH_TTL_SECONDS: 1800,        // 30 minutes for search queries
  METADATA_TTL_SECONDS: 86400,     // 24 hours for song metadata (static data)
  VECTOR_TTL_SECONDS: 86400,       // 24 hours for song vectors

  // Stampede mitigation
  JITTER_PERCENTAGE: 0.20,         // +/- 20% random spread on TTL

  // Cache key prefixes (namespaced)
  CACHE_PREFIX: {
    SEARCH: 'muze:search:',
    TRACK_META: 'muze:song:',
    TRACK_VECTOR: 'muze:vector:',
    VECTOR_TO_TRACK: 'muze:v2t:',
  },

  // Rate limiting defaults
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000,    // 15-minute window
    MAX_REQUESTS: 120,            // 120 requests per IP per window
    SEARCH_MAX_REQUESTS: 60,      // 60 search requests per minute per IP
    RECOMMEND_MAX_REQUESTS: 40,   // 40 recommend requests per minute per IP
  }
};
