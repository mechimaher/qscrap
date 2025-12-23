import { Router } from 'express';
import {
    getGarageStats,
    getGarageProfile,
    updateGarageBusinessDetails,
    getCustomerStats,
    getCustomerProfile,
    updateCustomerProfile,
    addAddress,
    deleteAddress,
    setDefaultAddress,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from '../controllers/dashboard.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Garage: Get dashboard stats
router.get('/garage/stats', authenticate, requireRole('garage'), getGarageStats);

// Garage: Get profile with subscription
router.get('/garage/profile', authenticate, requireRole('garage'), getGarageProfile);

// Garage: Update business details (CR number, bank info) - Qatar Legal Compliance
router.put('/garage/business-details', authenticate, requireRole('garage'), updateGarageBusinessDetails);

// Customer: Get dashboard stats
router.get('/customer/stats', authenticate, requireRole('customer'), getCustomerStats);

// Customer: Profile (for the profile section)
router.get('/profile', authenticate, getCustomerProfile);
router.put('/profile', authenticate, updateCustomerProfile);

// Customer: Addresses
router.post('/addresses', authenticate, addAddress);
router.delete('/addresses/:addressId', authenticate, deleteAddress);
router.post('/addresses/:addressId/default', authenticate, setDefaultAddress);

// Notifications (for any user type)
router.get('/notifications', authenticate, getNotifications);
router.post('/notifications/:notificationId/read', authenticate, markNotificationRead);
router.post('/notifications/read-all', authenticate, markAllNotificationsRead);

// Shorthand routes (IMPORTANT: These match what frontend dashboards expect)
router.get('/garage', authenticate, requireRole('garage'), getGarageStats);
router.get('/customer', authenticate, requireRole('customer'), getCustomerStats);

export default router;
