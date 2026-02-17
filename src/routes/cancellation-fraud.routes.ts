/**
 * Cancellation Fraud Prevention Routes (Operations Dashboard)
 * Mounted at /api/cancellation for frontend compatibility
 * 
 * These endpoints serve the Fraud Prevention Center in the Operations Dashboard.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeOperations } from '../middleware/authorize.middleware';
import {
    getFraudStats,
    getReturnRequests,
    approveReturnRequest,
    rejectReturnRequest,
    getAbuseTracking,
    updateAbuseFlag,
    getGaragePenalties
} from '../controllers/fraud.controller';

const router = Router();

// All routes require operations authorization
router.use(authenticate);
router.use(authorizeOperations);

/**
 * @route   GET /fraud-stats
 * @desc    Get fraud prevention statistics for dashboard
 * @access  Operations
 */
router.get('/fraud-stats', getFraudStats);

/**
 * @route   GET /return-requests
 * @desc    Get return requests with optional status filter
 * @access  Operations
 */
router.get('/return-requests', getReturnRequests);

/**
 * @route   POST /return-requests/:return_id/approve
 * @desc    Approve a return request
 * @access  Operations
 */
router.post('/return-requests/:return_id/approve', approveReturnRequest);

/**
 * @route   POST /return-requests/:return_id/reject
 * @desc    Reject a return request
 * @access  Operations
 */
router.post('/return-requests/:return_id/reject', rejectReturnRequest);

/**
 * @route   GET /abuse-tracking
 * @desc    Get customer abuse tracking data
 * @access  Operations
 */
router.get('/abuse-tracking', getAbuseTracking);

/**
 * @route   POST /abuse-flag
 * @desc    Update customer fraud flag
 * @access  Operations
 */
router.post('/abuse-flag', updateAbuseFlag);

/**
 * @route   GET /garage-penalties
 * @desc    Get garage penalties list
 * @access  Operations
 */
router.get('/garage-penalties', getGaragePenalties);

export default router;

