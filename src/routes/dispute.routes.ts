import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth.middleware';
import {
    createDispute,
    getMyDisputes,
    getDisputeDetails,
    garageRespondToDispute,
    getPendingDisputesCount
} from '../controllers/dispute.controller';

const router = express.Router();

// Multer config for dispute photos
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `dispute_${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Customer creates dispute
router.post('/', authenticate, upload.array('photos', 5), createDispute);

// Get my disputes (works for both customer and garage)
router.get('/my', authenticate, getMyDisputes);

// Get pending disputes count (garage)
router.get('/pending-count', authenticate, getPendingDisputesCount);

// Get dispute details
router.get('/:dispute_id', authenticate, getDisputeDetails);

// Garage responds to dispute
router.post('/:dispute_id/garage-respond', authenticate, garageRespondToDispute);

export default router;
