/**
 * Search Controller
 * -----------------
 * Handles incoming GET /search?q="query" requests.
 */

import { searchService } from '../services/search.service.js';

export async function handleSearch(req, res, next) {
  try {
    const rawQuery = req.query.q;
    const limit = parseInt(req.query.limit || '20', 10);

    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter "q". Example: /search?q=bohemian',
      });
    }

    const cleanQuery = rawQuery.trim();
    const results = await searchService.searchSongs(cleanQuery, limit);

    return res.status(200).json({
      success: true,
      query: cleanQuery,
      count: results.length,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

