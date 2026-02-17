import express from 'express';
import { requestContext } from '../middleware/requestContext.middleware';
import { getPublicConfig } from '../controllers/config.controller';

const router = express.Router();

/**
 * @route   GET /api/config/public
 * @desc    Get public configuration (safe keys only)
 * @access  Public
 */
router.get('/public', requestContext, getPublicConfig);

export default router;
