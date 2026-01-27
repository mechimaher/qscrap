/**
 * Finance Controller - Refactored to use Service Layer
 * All business logic delegated to PayoutService, RefundService, and RevenueService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import {
    PayoutService,
    RefundService,
    RevenueService,
    isFinanceError,
    getHttpStatusForError
} from '../services/finance';

// Initialize services
const payoutService = new PayoutService(pool);
const refundService = new RefundService(pool);
const revenueService = new RevenueService(pool);

// ============================================
// PAYOUT SUMMARY & LIST
// ============================================

export const getPayoutSummary = async (req: AuthRequest, res: Response) => {
    try {
        const summary = await payoutService.getPayoutSummary(
            req.user!.userId,
            req.user!.userType
        );
        res.json(summary);
    } catch (err) {
        console.error('getPayoutSummary Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payout summary' });
    }
};

export const getPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const { status, garage_id, page, limit, from_date, to_date } = req.query;

        const result = await payoutService.getPayouts({
            status: status as any,
            garage_id: garage_id as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            from_date: from_date as string,
            to_date: to_date as string,
            userId: req.user!.userId,
            userType: req.user!.userType as any
        });

        res.json(result);
    } catch (err) {
        console.error('getPayouts Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payouts' });
    }
};

export const getPayoutStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const statusDetail = await payoutService.getPayoutStatus(payout_id);
        res.json(statusDetail);
    } catch (err) {
        console.error('getPayoutStatus Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payout status' });
    }
};

export const getPaymentStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await payoutService.getPaymentStats();
        res.json(stats);
    } catch (err) {
        console.error('getPaymentStats Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch payment stats' });
    }
};

// Get payouts still within 7-day warranty window
export const getInWarrantyPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const payouts = await payoutService.getInWarrantyPayouts(
            req.user!.userType,
            req.user!.userId
        );
        res.json({ in_warranty_payouts: payouts, count: payouts.length });
    } catch (err) {
        console.error('getInWarrantyPayouts Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch in-warranty payouts' });
    }
};

export const getPayoutConfig = async (_req: AuthRequest, res: Response) => {
    res.json({
        auto_confirm_days: 7,
        min_payout_amount: 50,
        payout_methods: ['bank_transfer', 'cash', 'cheque'],
        currencies: ['QAR']
    });
};

// ============================================
// 2-WAY CONFIRMATION WORKFLOW
// ============================================

export const sendPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const result = await payoutService.sendPayment(payout_id, req.body);
        res.json(result);
    } catch (err) {
        console.error('sendPayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to send payment' });
    }
};

export const confirmPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const garageId = req.user!.userId;

        const result = await payoutService.confirmPayment(payout_id, garageId, req.body);
        res.json(result);
    } catch (err) {
        console.error('confirmPayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
};

export const disputePayment = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const garageId = req.user!.userId;

        const result = await payoutService.disputePayment(payout_id, garageId, req.body);
        res.json(result);
    } catch (err) {
        console.error('disputePayment Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to dispute payment' });
    }
};

export const resolvePaymentDispute = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const result = await payoutService.resolveDispute(payout_id, req.body);
        res.json(result);
    } catch (err) {
        console.error('resolvePaymentDispute Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to resolve dispute' });
    }
};

export const sendPaymentReminder = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const result = await payoutService.sendReminder(payout_id);

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json(result);
    } catch (err) {
        console.error('sendPaymentReminder Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to send reminder' });
    }
};

export const getAwaitingConfirmation = async (req: AuthRequest, res: Response) => {
    try {
        const garageId = req.user!.userId;
        const payouts = await payoutService.getAwaitingConfirmation(garageId);
        res.json({ awaiting_confirmation: payouts });
    } catch (err) {
        console.error('getAwaitingConfirmation Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch awaiting confirmation' });
    }
};

export const confirmAllPayouts = async (req: AuthRequest, res: Response) => {
    // DISABLED FOR COMPLIANCE: Each payout must be confirmed individually
    // to ensure proper verification and audit trail
    return res.status(403).json({
        error: 'Bulk confirmation disabled for compliance',
        message: 'Please confirm each payout individually to ensure proper verification and documentation.',
        compliance_reason: 'Financial controls require individual verification of each transaction'
    });

    /* ORIGINAL CODE PRESERVED FOR REFERENCE:
    try {
        const garageId = req.user!.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required for bulk confirmation' });
        }

        const result = await payoutService.confirmAllPayouts(garageId, password);
        res.json(result);
    } catch (err) {
        console.error('confirmAllPayouts Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to confirm payouts' });
    }
    */
};

// ============================================
// ADMIN PAYOUT OPERATIONS
// ============================================

export const processPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        await payoutService.processPayout(payout_id);
        res.json({ message: 'Payout processed successfully' });
    } catch (err) {
        console.error('processPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to process payout' });
    }
};

export const holdPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Hold reason required' });
        }

        await payoutService.holdPayout(payout_id, reason);
        res.json({ message: 'Payout held successfully' });
    } catch (err) {
        console.error('holdPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to hold payout' });
    }
};

export const releasePayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        await payoutService.releasePayout(payout_id);
        res.json({ message: 'Payout released successfully' });
    } catch (err) {
        console.error('releasePayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to release payout' });
    }
};

export const forceProcessPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Reason required for force processing' });
        }

        const result = await payoutService.forceProcessPayout(payout_id, reason);
        res.json(result);
    } catch (err) {
        console.error('forceProcessPayout Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to force process payout' });
    }
};

// ============================================
// BATCH PAYMENT OPERATIONS
// ============================================

/**
 * Get list of garages with pending payouts (for filter dropdown)
 */
export const getGaragesWithPendingPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const result = await payoutService.getGaragesWithPendingPayouts();
        res.json(result);
    } catch (err) {
        console.error('getGaragesWithPendingPayouts Error:', err);
        res.status(500).json({ error: 'Failed to load garages' });
    }
};

/**
 * Get preview of batch payouts before processing
 */
export const getBatchPayoutPreview = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_ids, garage_id, all_pending } = req.body;

        const result = await payoutService.getBatchPayoutPreview({
            payout_ids,
            garage_id,
            all_pending
        });

        res.json(result);
    } catch (err) {
        console.error('getBatchPayoutPreview Error:', err);
        res.status(500).json({ error: 'Failed to get batch preview' });
    }
};

/**
 * Send batch payments efficiently
 * Single API call to process many payouts
 */
export const sendBatchPayments = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_ids, garage_id, all_pending, reference_number, notes } = req.body;
        const sentBy = req.user?.userId;

        if (!sentBy) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!reference_number) {
            return res.status(400).json({ error: 'Reference number is required' });
        }

        // Safety check - require confirmation for large batches
        if (all_pending && !payout_ids && !garage_id) {
            const preview = await payoutService.getBatchPayoutPreview({ all_pending: true });
            if (preview.count > 100 && !req.body.confirmed) {
                return res.status(400).json({
                    error: 'Large batch requires confirmation',
                    preview,
                    requires_confirmation: true
                });
            }
        }

        const result = await payoutService.sendBatchPayments({
            payout_ids,
            garage_id,
            all_pending,
            reference_number,
            notes
        }, sentBy);

        res.json(result);
    } catch (err) {
        console.error('sendBatchPayments Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to process batch payments' });
    }
};

// ============================================
// PAYOUT STATEMENTS / TAX INVOICES
// ============================================

/**
 * Generate consolidated payout statement (Tax Invoice) for a garage
 * Returns HTML or PDF based on format query param
 */
export const getPayoutStatement = async (req: AuthRequest, res: Response) => {
    try {
        const { garageId } = req.params;
        const { from_date, to_date, format = 'html' } = req.query;

        // Validate required params
        if (!from_date || !to_date) {
            return res.status(400).json({
                error: 'Date range required',
                message: 'Please provide from_date and to_date query parameters (YYYY-MM-DD)'
            });
        }

        // Validate date range (max 3 months)
        const fromDate = new Date(from_date as string);
        const toDate = new Date(to_date as string);
        const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 93) {
            return res.status(400).json({
                error: 'Date range too large',
                message: 'Maximum date range is 3 months (93 days)'
            });
        }

        if (diffDays < 0) {
            return res.status(400).json({
                error: 'Invalid date range',
                message: 'from_date must be before to_date'
            });
        }

        // Generate statement data
        const statementData = await payoutService.generatePayoutStatement({
            garage_id: garageId,
            from_date: from_date as string,
            to_date: to_date as string
        });

        // If no orders found
        if (statementData.orders.length === 0) {
            return res.status(404).json({
                error: 'No confirmed payouts found',
                message: `No confirmed payouts found for this garage between ${from_date} and ${to_date}`
            });
        }

        // Generate HTML
        const { generatePayoutStatementHTML } = await import('./payout-statement-template');

        // Generate QR code
        let qrCode = '';
        try {
            const QRCode = require('qrcode');
            const verifyUrl = `https://theqscrap.com/verify/${statementData.statement_number}`;
            qrCode = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
        } catch (e) {
            console.warn('QR code generation failed:', e);
        }

        // Get logo base64
        const fs = require('fs');
        const path = require('path');
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, '../../public/images/qscrap-logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = fs.readFileSync(logoPath).toString('base64');
            }
        } catch (e) {
            console.warn('Logo loading failed:', e);
        }

        const html = generatePayoutStatementHTML(statementData, qrCode, logoBase64);

        // Return based on format
        if (format === 'pdf') {
            // Try to use Puppeteer for PDF
            try {
                const puppeteer = require('puppeteer');
                const browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();
                await page.setContent(html, { waitUntil: 'networkidle0' });
                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
                });
                await browser.close();

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition',
                    `attachment; filename="invoice-${statementData.statement_number}.pdf"`);
                return res.send(pdfBuffer);
            } catch (pdfErr) {
                console.warn('PDF generation failed, falling back to HTML:', pdfErr);
                // Fall through to HTML
            }
        }

        // Return HTML
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (err) {
        console.error('getPayoutStatement Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to generate payout statement' });
    }
};

// ============================================
// REFUND OPERATIONS
// ============================================

export const createRefund = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const { refund_amount, refund_reason, refund_method } = req.body;

        if (!refund_amount || !refund_reason) {
            return res.status(400).json({ error: 'Refund amount and reason required' });
        }

        const result = await refundService.createRefund({
            order_id,
            refund_amount: parseFloat(refund_amount),
            refund_reason,
            refund_method,
            initiated_by: req.user!.userId
        });

        res.json(result);
    } catch (err) {
        console.error('createRefund Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to create refund' });
    }
};

export const getRefunds = async (req: AuthRequest, res: Response) => {
    try {
        const { status, page, limit } = req.query;

        const result = await refundService.getRefunds({
            status: status as string,
            limit: limit ? parseInt(limit as string) : undefined,
            offset: page ? (parseInt(page as string) - 1) * (parseInt(limit as string) || 50) : undefined
        });

        res.json(result);
    } catch (err) {
        console.error('getRefunds Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch refunds' });
    }
};

/**
 * Get pending refunds for Operations dashboard
 */
export const getPendingRefunds = async (req: AuthRequest, res: Response) => {
    try {
        const result = await refundService.getPendingRefunds();
        res.json(result);
    } catch (err) {
        console.error('getPendingRefunds Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch pending refunds' });
    }
};

/**
 * Execute Stripe refund for a pending refund
 * This actually calls Stripe API to process the refund
 */
export const processStripeRefund = async (req: AuthRequest, res: Response) => {
    try {
        const { refund_id } = req.params;
        const processedBy = req.user!.userId;

        const result = await refundService.executeStripeRefund(refund_id, processedBy);
        res.json(result);
    } catch (err: any) {
        console.error('processStripeRefund Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Failed to process refund' });
    }
};

// ============================================
// REVENUE & TRANSACTIONS
// ============================================

export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const { period = '30d', garage_id } = req.query;

        const report = await revenueService.getRevenueReport(
            period as any,
            garage_id ? { garage_id: garage_id as string } : undefined
        );

        res.json(report);
    } catch (err) {
        console.error('getRevenueReport Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch revenue report' });
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const { status, from_date, to_date, page, limit } = req.query;

        const transactions = await revenueService.getTransactions({
            user_id: req.user!.userId,
            user_type: req.user!.userType as any,
            status: status ? (status as string).split(',') : undefined,
            from_date: from_date ? new Date(from_date as string) : undefined,
            to_date: to_date ? new Date(to_date as string) : undefined,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });

        res.json({ transactions });
    } catch (err) {
        console.error('getTransactions Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

export const getTransactionDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const detail = await revenueService.getTransactionDetail(order_id);
        res.json(detail);
    } catch (err) {
        console.error('getTransactionDetails Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
};

// ============================================
// CRON JOB - Auto-confirm payouts
// ============================================

export const autoConfirmPayouts = async () => {
    try {
        const result = await PayoutService.autoConfirmPayouts(pool);
        console.log(`[CRON] Auto-confirmed ${result.confirmed} payouts, ${result.failed} failed`);
        return result;
    } catch (err) {
        console.error('[CRON] autoConfirmPayouts error:', err);
        return { confirmed: 0, failed: 1 };
    }
};
