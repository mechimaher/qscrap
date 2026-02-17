import { Router } from 'express';
import {
    getHealth,
    getDetailedHealth,
    getPlatformStatus,
    getMetrics
} from '../controllers/health.controller';

const router = Router();

/**
 * @route   GET /health
 * @desc    Simple health check endpoint
 * @access  Public
 */
router.get('/health', getHealth);

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with all services
 * @access  Public
 */
router.get('/health/detailed', getDetailedHealth);

/**
 * @route   GET /status
 * @desc    Platform status and metrics
 * @access  Public
 */
router.get('/status', getPlatformStatus);

/**
 * @route   GET /metrics
 * @desc    Basic metrics for monitoring
 * @access  Public
 */
router.get('/metrics', getMetrics);

export default router;
