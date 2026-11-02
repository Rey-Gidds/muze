/**
 * Cache Jitter Utility
 * --------------------
 * Calculates a jittered TTL to disperse cache expiration times and prevent
 * thundering herds on database backends.
 */

import { CONSTANTS } from '../config/constants.js';

/**
 * Returns a TTL in seconds with random jitter applied within +/- jitterFactor.
 * E.g., for base = 3600 and factor = 0.2, result will be uniformly distributed
 * between 2880 and 4320 seconds.
 *
 * @param {number} baseTtlSeconds Base TTL in seconds
 * @param {number} jitterFactor Fractional spread (default from constants: 0.20)
 * @returns {number} Integer seconds with jitter
 */
export function getJitteredTtl(baseTtlSeconds = CONSTANTS.DEFAULT_TTL_SECONDS, jitterFactor = CONSTANTS.JITTER_PERCENTAGE) {
  const min = baseTtlSeconds * (1 - jitterFactor);
  const max = baseTtlSeconds * (1 + jitterFactor);
  return Math.floor(min + Math.random() * (max - min));
}
