import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
    createRepairRequest,
    getMyRepairRequests,
    getRepairRequestDetails,
    acceptRepairBid,
    getMyRepairBookings,
    getActiveRepairRequests,
    submitRepairBid,
    getMyRepairBids,
    getWorkshopBookings,
    updateBookingStatus
} from '../controllers/repair.controller';

const router = Router();

// ============================================
// REPAIR MARKETPLACE ROUTES
// ============================================

// --- Customer Routes ---
// Create repair request
router.post('/requests', authenticate, createRepairRequest);

// Get my repair requests
router.get('/requests/my', authenticate, getMyRepairRequests);

// Get repair request details with bids
router.get('/requests/:request_id', authenticate, getRepairRequestDetails);

// Accept a bid (creates booking)
router.post('/bids/:bid_id/accept', authenticate, acceptRepairBid);

// Get my bookings (customer)
router.get('/bookings/my', authenticate, getMyRepairBookings);

// --- Workshop Routes ---
// Get active repair requests (for bidding)
router.get('/requests/active', authenticate, requireRole('garage'), getActiveRepairRequests);

// Submit bid on a request
router.post('/requests/:request_id/bid', authenticate, requireRole('garage'), submitRepairBid);

// Get my submitted bids
router.get('/bids/my', authenticate, requireRole('garage'), getMyRepairBids);

// Get workshop bookings (with filters)
router.get('/bookings/workshop', authenticate, requireRole('garage'), getWorkshopBookings);

// Update booking status (check-in, in-progress, completed, etc.)
router.patch('/bookings/:booking_id/status', authenticate, requireRole('garage'), updateBookingStatus);

export default router;
