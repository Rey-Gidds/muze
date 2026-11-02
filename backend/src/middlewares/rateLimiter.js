/**
 * IP-Based Rate Limiting Middlewares
 * -----------------------------------
 * Protects endpoints from abuse and DoS using sliding-window rate limiters.
 */

import rateLimit from 'express-rate-limit';
import { CONSTANTS } from '../config/constants.js';

/**
 * Standard API rate limiter applied globally.
 */
export const generalLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
});

/**
 * Dedicated rate limiter for /search endpoint (up to 60 searches per minute).
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONSTANTS.RATE_LIMIT.SEARCH_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Search rate limit exceeded. Please wait a moment before searching again.',
  },
});

/**
 * Dedicated rate limiter for /recommend endpoint (up to 40 recommendation queries per minute).
 */
export const recommendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONSTANTS.RATE_LIMIT.RECOMMEND_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Recommendation rate limit exceeded. Please wait a moment.',
  },
});

