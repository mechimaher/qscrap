import { Router } from 'express';
import {
    getGarageStats,
    getGarageProfile,
    updateGarageBusinessDetails,
    updateGarageSpecialization,
    updateGarageLocation,
    getCustomerStats,
    getCustomerProfile,
    updateCustomerProfile,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications
} from '../controllers/dashboard.controller';
import {
    getCustomerUrgentActions,
    getCustomerContextualData
} from '../controllers/dashboard-urgent.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

// Garage: Get dashboard stats
router.get('/garage/stats', authenticate, requireRole('garage'), getGarageStats);

// Garage: Get profile with subscription
router.get('/garage/profile', authenticate, requireRole('garage'), getGarageProfile);

// Garage: Update business details (CR number, bank info) - Qatar Legal Compliance
router.put('/garage/business-details', authenticate, requireRole('garage'), updateGarageBusinessDetails);

// Garage: Update specialization (supplier type, brands)
router.put('/garage/specialization', authenticate, requireRole('garage'), updateGarageSpecialization);

// Garage: Update location (GPS coordinates for driver navigation)
router.put('/garage/location', authenticate, requireRole('garage'), updateGarageLocation);

// Customer: Get dashboard stats
router.get('/customer/stats', authenticate, requireRole('customer'), getCustomerStats);

// Customer: Get unified activity feed (Parts Orders only - Quick Services purged Jan 19)
router.get('/customer/activity', authenticate, requireRole('customer'), async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const pool = (await import('../config/db')).default;

        // Parts Marketplace orders only (Quick Services purged Jan 19, 2026)
        const result = await pool.query(`
            SELECT 
                order_id::text as id,
                'spare_part' as type,
                created_at as date,
                order_status as status,
                'Spare Parts Order' as title,
                'Order #' || SUBSTRING(order_id::text, 1, 8) as subtitle,
                COALESCE(total_amount, 0) as price,
                'QAR' as currency,
                'spare_part' as icon_key,
                actual_delivery_at as completed_at,
                delivery_address
            FROM orders
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        // Get total count for pagination
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM orders WHERE customer_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            activities: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: Math.floor(offset / limit) + 1,
            limit
        });
    } catch (error) {
        logger.error('Get customer activity error', { error });
        res.status(500).json({ success: false, error: 'Failed to fetch activity' });
    }
});


// Customer: Get urgent actions (priority-based)
router.get('/customer/urgent-actions', authenticate, requireRole('customer'), getCustomerUrgentActions);

// Customer: Get contextual data (insights, unread counts)
router.get('/customer/contextual-data', authenticate, requireRole('customer'), getCustomerContextualData);

// Customer: Profile (for the profile section)
router.get('/profile', authenticate, getCustomerProfile);
router.put('/profile', authenticate, updateCustomerProfile);

// Customer: Addresses - DEPRECATED: Use /api/addresses instead
// Routes kept for backwards compatibility but should migrate to dedicated address routes

// Notifications (for any user type)
router.get('/notifications', authenticate, getNotifications);
router.post('/notifications/:notificationId/read', authenticate, markNotificationRead);
router.post('/notifications/read-all', authenticate, markAllNotificationsRead);
router.delete('/notifications/:notificationId', authenticate, deleteNotification);
router.delete('/notifications', authenticate, clearAllNotifications);

// Shorthand routes (IMPORTANT: These match what frontend dashboards expect)
router.get('/garage', authenticate, requireRole('garage'), getGarageStats);
router.get('/customer', authenticate, requireRole('customer'), getCustomerStats);

// Garage Badge Counts - For dashboard notification badges
router.get('/garage/badge-counts', authenticate, requireRole('garage'), async (req, res) => {
    try {
        // For garage users, userId IS garageId (they're the same)
        const garageId = (req as any).user?.userId;
        if (!garageId) return res.status(403).json({ error: 'Garage not found' });

        const pool = (await import('../config/db')).default;
        const { BadgeCountService } = await import('../services/notification/badge.service');
        const badgeService = new BadgeCountService(pool);

        const counts = await badgeService.getGarageBadgeCounts(garageId);
        res.json({ success: true, ...counts });
    } catch (err) {
        logger.error('Garage badge counts error', { error: err });
        res.status(500).json({ error: 'Failed to get badge counts' });
    }
});

// Garage: Self-service consolidated Tax Invoice (for garage portal)
router.get('/garage/my-payout-statement', authenticate, requireRole('garage'), async (req, res) => {
    try {
        const garageId = (req as any).user?.userId;
        if (!garageId) return res.status(403).json({ error: 'Garage not found' });

        const from_date = req.query.from_date as string;
        const to_date = req.query.to_date as string;
        const format = (req.query.format as string) || 'html';

        if (!from_date || !to_date) {
            return res.status(400).json({ error: 'from_date and to_date are required' });
        }

        const pool = (await import('../config/db')).default;
        const { PayoutService } = await import('../services/finance/payout.service');
        const payoutService = new PayoutService(pool);

        const statementData = await payoutService.generatePayoutStatement({
            garage_id: garageId,
            from_date,
            to_date
        });

        if (!statementData) {
            return res.status(404).json({ error: 'No confirmed payouts found for this period' });
        }

        // Generate QR code
        let qrCode = '';
        try {
            const QRCode = require('qrcode');
            const verifyUrl = `https://qscrap.qa/verify/${statementData.statement_number}`;
            qrCode = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
        } catch (e) {
            logger.warn('QR generation failed', { error: e });
        }

        // Get logo
        const fs = require('fs');
        const path = require('path');
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, '../../public/images/qscrap-logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = fs.readFileSync(logoPath).toString('base64');
            }
        } catch (e) {
            logger.warn('Logo loading failed', { error: e });
        }

        const { generatePayoutStatementHTML } = await import('../controllers/payout-statement-template');
        const html = generatePayoutStatementHTML(statementData, qrCode, logoBase64);

        if (format === 'pdf') {
            try {
                const { DocumentGenerationService } = await import('../services/documents/document-generation.service');
                const docService = new DocumentGenerationService(pool);
                const pdfBuffer = await docService.generatePDF(html);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition',
                    `attachment; filename="invoice-${statementData.statement_number}.pdf"`);
                return res.send(pdfBuffer);
            } catch (pdfErr) {
                logger.warn('PDF generation failed, falling back to HTML', { error: pdfErr });
            }
        }

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        logger.error('Garage payout statement error', { error: err });
        res.status(500).json({ error: 'Failed to generate statement' });
    }
});

export default router;
