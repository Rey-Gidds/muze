/**
 * Recommend Controller
 * --------------------
 * Handles incoming POST /recommend requests.
 */

import { recommendService } from '../services/recommend.service.js';
import { CONSTANTS } from '../config/constants.js';

export async function handleRecommend(req, res, next) {
  try {
    const { track_id, top_k } = req.body || {};

    if (!track_id || typeof track_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "track_id" in request body.',
      });
    }

    const limit = top_k ? parseInt(top_k, 10) : CONSTANTS.DEFAULT_TOP_K;
    const recommendations = await recommendService.getRecommendations(track_id.trim(), limit);

    return res.status(200).json({
      success: true,
      track_id: track_id.trim(),
      count: recommendations.length,
      data: recommendations,
    });
  } catch (err) {
    next(err);
  }
}

