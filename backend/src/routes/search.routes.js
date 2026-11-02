/**
 * Search Routes
 * -------------
 * GET /search?q="query"
 */

import { Router } from 'express';
import { handleSearch } from '../controllers/search.controller.js';
import { searchLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/', searchLimiter, handleSearch);

export default router;

