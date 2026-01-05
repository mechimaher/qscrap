import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload, optimizeFiles } from '../middleware/file.middleware';
import { validateParams, disputeIdParamSchema } from '../middleware/validation.middleware';
import {
    createDispute,
    getMyDisputes,
    getDisputeDetails,
    garageRespondToDispute,
    getPendingDisputesCount
} from '../controllers/dispute.controller';

const router = express.Router();

// Customer creates dispute (with image optimization)
router.post('/', authenticate, upload.array('photos', 5), optimizeFiles, createDispute);

// Get my disputes (works for both customer and garage)
router.get('/my', authenticate, getMyDisputes);

// Get pending disputes count (garage)
router.get('/pending-count', authenticate, getPendingDisputesCount);

// Get dispute details
router.get('/:dispute_id', authenticate, validateParams(disputeIdParamSchema), getDisputeDetails);

// Garage responds to dispute
router.post('/:dispute_id/garage-respond', authenticate, validateParams(disputeIdParamSchema), garageRespondToDispute);

export default router;
