/**
 * Recommendation Routes
 * ---------------------
 * POST /recommend
 */

import { Router } from 'express';
import { handleRecommend } from '../controllers/recommend.controller.js';
import { recommendLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/', recommendLimiter, handleRecommend);

export default router;

