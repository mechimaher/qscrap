import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { universalSearch, getSearchSuggestions } from '../controllers/search.controller';

const router = Router();

// All search routes require authentication
router.use(authenticate);

// Main search endpoint
router.get('/', universalSearch);

// Quick suggestions for autocomplete
router.get('/suggestions', getSearchSuggestions);

export default router;
