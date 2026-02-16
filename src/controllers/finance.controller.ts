/**
 * Finance Controller - Refactored to use Service Layer
 * All business logic delegated to PayoutService, RefundService, and RevenueService
 */

import fs from 'node:fs';
import path from 'node:path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import {
    BatchPaymentDto,
    ConfirmPaymentDto,
    DisputeDto,
    PayoutService,
    PayoutStatus,
    PayoutFilters,
    RefundService,
    ResolveDisputeDto,
    RevenuePeriod,
    RevenueService,
    SendPaymentDto,
    TransactionFilters,
    isFinanceError,
    getHttpStatusForError
} from '../services/finance';
import { createNotification } from '../services/notification.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';

// Initialize services
const payoutService = new PayoutService(pool);
const refundService = new RefundService(pool);
const revenueService = new RevenueService(pool);

interface ReasonBody {
    reason?: string;
}

interface BatchPreviewBody {
    payout_ids?: string[];
    garage_id?: string;
    all_pending?: boolean;
}

interface BatchPaymentBody extends BatchPreviewBody {
    reference_number?: string;
    notes?: string;
    confirmed?: boolean;
}

interface CreateRefundBody {
    refund_amount?: number | string;
    refund_reason?: string;
    refund_method?: string;
}

interface RejectRefundBody {
    reason?: string;
}

interface ApproveCompensationBody {
    notes?: string;
}

interface DenyCompensationBody {
    reason?: string;
    apply_penalty?: boolean | string;
    penalty_type?: string;
    penalty_amount?: number | string;
}

interface CompensationPayoutRow {
    payout_id: string;
    order_id: string;
    garage_id: string;
    net_amount: number;
}

interface QRCodeModule {
    toDataURL(text: string, options?: { width?: number; margin?: number }): Promise<string>;
}

const payoutStatuses: PayoutStatus[] = [
    'pending',
    'processing',
    'awaiting_confirmation',
    'confirmed',
    'completed',
    'held',
    'disputed',
    'cancelled'
];

const revenuePeriods: RevenuePeriod[] = ['7d', '30d', '90d'];

const getAuthenticatedUser = (req: AuthRequest): { userId: string; userType: string } | null => {
    if (!req.user?.userId || !req.user.userType) {
        return null;
    }
    return { userId: req.user.userId, userType: req.user.userType };
};

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: number | string | undefined): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const toOptionalBoolean = (value: boolean | string | undefined): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    return undefined;
};

const toFinanceUserType = (userType: string): PayoutFilters['userType'] => {
    if (userType === 'garage') {
        return 'garage';
    }
    if (userType === 'operations') {
        return 'operations';
    }
    return 'admin';
};

const toPayoutStatus = (value: string | undefined): PayoutStatus | undefined => {
    if (!value) {
        return undefined;
    }
    return payoutStatuses.includes(value as PayoutStatus) ? (value as PayoutStatus) : undefined;
};

const toRevenuePeriod = (value: string | undefined): RevenuePeriod | null => {
    if (!value) {
        return '30d';
    }
    return revenuePeriods.includes(value as RevenuePeriod) ? (value as RevenuePeriod) : null;
};

const logFinanceError = (context: string, err: unknown): void => {
    logger.error(context, { error: getErrorMessage(err) });
};

const sendFinanceError = (res: Response, err: unknown, fallbackMessage: string): Response => {
    if (isFinanceError(err)) {
        return res.status(getHttpStatusForError(err)).json({ error: err.message });
    }
    return res.status(500).json({ error: fallbackMessage });
};

// ============================================
// PAYOUT SUMMARY & LIST
// ============================================

export const getPayoutSummary = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const summary = await payoutService.getPayoutSummary(
            user.userId,
            user.userType
        );
        res.json(summary);
    } catch (err) {
        logFinanceError('getPayoutSummary Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch payout summary');
    }
};

export const getPayouts = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const status = toPayoutStatus(toQueryString(req.query.status));
        const garageId = toQueryString(req.query.garage_id);
        const page = toOptionalInt(req.query.page);
        const limit = toOptionalInt(req.query.limit);
        const fromDate = toQueryString(req.query.from_date);
        const toDate = toQueryString(req.query.to_date);

        const result = await payoutService.getPayouts({
            status,
            garage_id: garageId,
            page,
            limit,
            from_date: fromDate,
            to_date: toDate,
            userId: user.userId,
            userType: toFinanceUserType(user.userType)
        });

        res.json(result);
    } catch (err) {
        logFinanceError('getPayouts Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch payouts');
    }
};

export const getPayoutStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const statusDetail = await payoutService.getPayoutStatus(payout_id);
        res.json(statusDetail);
    } catch (err) {
        logFinanceError('getPayoutStatus Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch payout status');
    }
};

export const getPaymentStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await payoutService.getPaymentStats();
        res.json(stats);
    } catch (err) {
        logFinanceError('getPaymentStats Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch payment stats');
    }
};

// Get payouts still within 7-day warranty window
export const getInWarrantyPayouts = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const payouts = await payoutService.getInWarrantyPayouts(
            user.userType,
            user.userId
        );
        res.json({ in_warranty_payouts: payouts, count: payouts.length });
    } catch (err) {
        logFinanceError('getInWarrantyPayouts Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch in-warranty payouts');
    }
};

export const getPayoutConfig = (_req: AuthRequest, res: Response) => {
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
        const details = req.body as unknown as SendPaymentDto;
        const result = await payoutService.sendPayment(payout_id, details);
        res.json(result);
    } catch (err) {
        logFinanceError('sendPayment Error:', err);
        return sendFinanceError(res, err, 'Failed to send payment');
    }
};

export const confirmPayment = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { payout_id } = req.params;
        const details = req.body as unknown as ConfirmPaymentDto;

        const result = await payoutService.confirmPayment(payout_id, user.userId, details);
        res.json(result);
    } catch (err) {
        logFinanceError('confirmPayment Error:', err);
        return sendFinanceError(res, err, 'Failed to confirm payment');
    }
};

export const disputePayment = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { payout_id } = req.params;
        const dispute = req.body as unknown as DisputeDto;

        const result = await payoutService.disputePayment(payout_id, user.userId, dispute);
        res.json(result);
    } catch (err) {
        logFinanceError('disputePayment Error:', err);
        return sendFinanceError(res, err, 'Failed to dispute payment');
    }
};

export const resolvePaymentDispute = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const resolution = req.body as unknown as ResolveDisputeDto;
        const result = await payoutService.resolveDispute(payout_id, resolution);
        res.json(result);
    } catch (err) {
        logFinanceError('resolvePaymentDispute Error:', err);
        return sendFinanceError(res, err, 'Failed to resolve dispute');
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
        logFinanceError('sendPaymentReminder Error:', err);
        return sendFinanceError(res, err, 'Failed to send reminder');
    }
};

export const getAwaitingConfirmation = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const payouts = await payoutService.getAwaitingConfirmation(user.userId);
        res.json({ awaiting_confirmation: payouts });
    } catch (err) {
        logFinanceError('getAwaitingConfirmation Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch awaiting confirmation');
    }
};

export const confirmAllPayouts = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await payoutService.confirmAllPayouts(user.userId);
        res.json(result);
    } catch (err) {
        logFinanceError('confirmAllPayouts Error:', err);
        return sendFinanceError(res, err, 'Failed to confirm payouts');
    }
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
        logFinanceError('processPayout Error:', err);
        return sendFinanceError(res, err, 'Failed to process payout');
    }
};

export const holdPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const body = req.body as unknown as ReasonBody;
        const reason = body.reason;

        if (!reason) {
            return res.status(400).json({ error: 'Hold reason required' });
        }

        await payoutService.holdPayout(payout_id, reason);
        res.json({ message: 'Payout held successfully' });
    } catch (err) {
        logFinanceError('holdPayout Error:', err);
        return sendFinanceError(res, err, 'Failed to hold payout');
    }
};

export const releasePayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        await payoutService.releasePayout(payout_id);
        res.json({ message: 'Payout released successfully' });
    } catch (err) {
        logFinanceError('releasePayout Error:', err);
        return sendFinanceError(res, err, 'Failed to release payout');
    }
};

export const forceProcessPayout = async (req: AuthRequest, res: Response) => {
    try {
        const { payout_id } = req.params;
        const body = req.body as unknown as ReasonBody;
        const reason = body.reason;

        if (!reason) {
            return res.status(400).json({ error: 'Reason required for force processing' });
        }

        const result = await payoutService.forceProcessPayout(payout_id, reason);
        res.json(result);
    } catch (err) {
        logFinanceError('forceProcessPayout Error:', err);
        return sendFinanceError(res, err, 'Failed to force process payout');
    }
};

// ============================================
// BATCH PAYMENT OPERATIONS
// ============================================

/**
 * Get list of garages with pending payouts (for filter dropdown)
 */
export const getGaragesWithPendingPayouts = async (_req: AuthRequest, res: Response) => {
    try {
        const result = await payoutService.getGaragesWithPendingPayouts();
        res.json(result);
    } catch (err) {
        logFinanceError('getGaragesWithPendingPayouts Error:', err);
        res.status(500).json({ error: 'Failed to load garages' });
    }
};

/**
 * Get preview of batch payouts before processing
 */
export const getBatchPayoutPreview = async (req: AuthRequest, res: Response) => {
    try {
        const body = req.body as unknown as BatchPreviewBody;
        const { payout_ids, garage_id, all_pending } = body;

        const result = await payoutService.getBatchPayoutPreview({
            payout_ids,
            garage_id,
            all_pending
        });

        res.json(result);
    } catch (err) {
        logFinanceError('getBatchPayoutPreview Error:', err);
        res.status(500).json({ error: 'Failed to get batch preview' });
    }
};

/**
 * Send batch payments efficiently
 * Single API call to process many payouts
 */
export const sendBatchPayments = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as BatchPaymentBody;
        const { payout_ids, garage_id, all_pending, reference_number, notes } = body;

        if (!reference_number) {
            return res.status(400).json({ error: 'Reference number is required' });
        }

        // Safety check - require confirmation for large batches
        if (all_pending && !payout_ids && !garage_id) {
            const preview = await payoutService.getBatchPayoutPreview({ all_pending: true });
            if (preview.count > 100 && !body.confirmed) {
                return res.status(400).json({
                    error: 'Large batch requires confirmation',
                    preview,
                    requires_confirmation: true
                });
            }
        }

        const dto: BatchPaymentDto = {
            payout_ids,
            garage_id,
            all_pending,
            reference_number,
            notes
        };

        const result = await payoutService.sendBatchPayments(dto, user.userId);

        res.json(result);
    } catch (err) {
        logFinanceError('sendBatchPayments Error:', err);
        return sendFinanceError(res, err, 'Failed to process batch payments');
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
        const fromDateParam = toQueryString(req.query.from_date);
        const toDateParam = toQueryString(req.query.to_date);
        const format = toQueryString(req.query.format) ?? 'html';

        // Validate required params
        if (!fromDateParam || !toDateParam) {
            return res.status(400).json({
                error: 'Date range required',
                message: 'Please provide from_date and to_date query parameters (YYYY-MM-DD)'
            });
        }

        // Validate date range (max 3 months)
        const fromDate = new Date(fromDateParam);
        const toDate = new Date(toDateParam);
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
            from_date: fromDateParam,
            to_date: toDateParam
        });

        // If no orders found
        if (statementData.orders.length === 0) {
            return res.status(404).json({
                error: 'No completed orders found',
                message: `No completed orders found for this garage between ${fromDateParam} and ${toDateParam}`
            });
        }

        // Generate HTML
        const { generatePayoutStatementHTML } = await import('./payout-statement-template');

        // Generate QR code
        let qrCode = '';
        try {
            const QRCode = await import('qrcode') as unknown as QRCodeModule;
            const verifyUrl = `https://theqscrap.com/verify/${statementData.statement_number}`;
            qrCode = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
        } catch (e) {
            logger.warn('QR code generation failed:', { error: getErrorMessage(e) });
        }

        // Get logo base64
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, '../../public/images/qscrap-logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = fs.readFileSync(logoPath).toString('base64');
            }
        } catch (e) {
            logger.warn('Logo loading failed:', { error: getErrorMessage(e) });
        }

        const html = generatePayoutStatementHTML(statementData, qrCode, logoBase64);

        // Return based on format
        if (format === 'pdf') {
            // Use existing DocumentGenerationService for PDF
            try {
                const { DocumentGenerationService } = await import('../services/documents/document-generation.service');
                const docService = new DocumentGenerationService(pool);
                const pdfBuffer = await docService.generatePDF(html);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition',
                    `attachment; filename="invoice-${statementData.statement_number}.pdf"`);
                return res.send(pdfBuffer);
            } catch (pdfErr) {
                logger.warn('PDF generation failed, falling back to HTML', { error: getErrorMessage(pdfErr) });
                // Fall through to HTML
            }
        }

        // Return HTML
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (err) {
        logFinanceError('getPayoutStatement Error:', err);
        return sendFinanceError(res, err, 'Failed to generate payout statement');
    }
};

// ============================================
// REFUND OPERATIONS
// ============================================

export const createRefund = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { order_id } = req.params;
        const body = req.body as unknown as CreateRefundBody;
        const { refund_amount, refund_reason, refund_method } = body;
        const refundAmount = toOptionalNumber(refund_amount);

        if (refundAmount === undefined || !refund_reason) {
            return res.status(400).json({ error: 'Refund amount and reason required' });
        }

        const result = await refundService.createRefund({
            order_id,
            refund_amount: refundAmount,
            refund_reason,
            refund_method,
            initiated_by: user.userId
        });

        res.json(result);
    } catch (err) {
        logFinanceError('createRefund Error:', err);
        return sendFinanceError(res, err, 'Failed to create refund');
    }
};

export const getRefunds = async (req: AuthRequest, res: Response) => {
    try {
        const status = toQueryString(req.query.status);
        const page = toOptionalInt(req.query.page);
        const limit = toOptionalInt(req.query.limit);
        const offset = page ? (page - 1) * (limit || 50) : undefined;

        const result = await refundService.getRefunds({
            status,
            limit,
            offset
        });

        // Prevent caching of API response
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(result);
    } catch (err) {
        logFinanceError('getRefunds Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch refunds');
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
        logFinanceError('getPendingRefunds Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch pending refunds');
    }
};

/**
 * Execute Stripe refund for a pending refund
 * This actually calls Stripe API to process the refund
 */
export const processStripeRefund = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { refund_id } = req.params;
        const processedBy = user.userId;

        const result = await refundService.executeStripeRefund(refund_id, processedBy);
        res.json(result);
    } catch (err) {
        logFinanceError('processStripeRefund Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) || 'Failed to process refund' });
    }
};

/**
 * Reject a pending refund request
 * Updates status to 'rejected' with reason
 */
export const rejectRefund = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { refund_id } = req.params;
        const body = req.body as unknown as RejectRefundBody;
        const reason = body.reason;
        const rejectedBy = user.userId;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason required' });
        }

        // Use service method which handles the full rejection lifecycle:
        // 1. Updates refund status to 'rejected'
        // 2. Restores order payment_status to 'paid' (from 'refund_pending')
        // 3. Unfreezes garage payout (from 'on_hold' back to 'pending')
        // 4. Notifies customer
        // All within a single transaction
        const result = await refundService.rejectRefund(refund_id, rejectedBy, reason);

        res.json(result);
    } catch (err) {
        logFinanceError('rejectRefund Error:', err);
        if (isFinanceError(err)) {
            return res.status(getHttpStatusForError(err)).json({ error: err.message });
        }
        res.status(500).json({ error: getErrorMessage(err) || 'Failed to reject refund' });
    }
};

// ============================================
// REVENUE & TRANSACTIONS
// ============================================

export const getRevenueReport = async (req: AuthRequest, res: Response) => {
    try {
        const period = toRevenuePeriod(toQueryString(req.query.period));
        const garageId = toQueryString(req.query.garage_id);

        if (!period) {
            return res.status(400).json({ error: 'Invalid period. Allowed values: 7d, 30d, 90d' });
        }

        const report = await revenueService.getRevenueReport(
            period,
            garageId ? { garage_id: garageId } : undefined
        );

        res.json(report);
    } catch (err) {
        logFinanceError('getRevenueReport Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch revenue report');
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const status = toQueryString(req.query.status);
        const fromDate = toQueryString(req.query.from_date);
        const toDate = toQueryString(req.query.to_date);
        const page = toOptionalInt(req.query.page);
        const limit = toOptionalInt(req.query.limit);

        const filters: TransactionFilters = {
            user_id: user.userId,
            user_type: toFinanceUserType(user.userType),
            status: status ? status.split(',') : undefined,
            from_date: fromDate ? new Date(fromDate) : undefined,
            to_date: toDate ? new Date(toDate) : undefined,
            page,
            limit
        };

        const transactions = await revenueService.getTransactions(filters);

        res.json({ transactions });
    } catch (err) {
        logFinanceError('getTransactions Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch transactions');
    }
};

export const getTransactionDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { order_id } = req.params;
        const detail = await revenueService.getTransactionDetail(order_id);
        res.json(detail);
    } catch (err) {
        logFinanceError('getTransactionDetails Error:', err);
        return sendFinanceError(res, err, 'Failed to fetch transaction details');
    }
};

// ============================================
// CRON JOB - Auto-confirm payouts
// ============================================

export const autoConfirmPayouts = async () => {
    try {
        const result = await PayoutService.autoConfirmPayouts(pool);
        logger.info(`Auto-confirmed ${result.confirmed} payouts, ${result.failed} failed`);
        return result;
    } catch (err) {
        logFinanceError('[CRON] autoConfirmPayouts error:', err);
        return { confirmed: 0, failed: 1 };
    }
};

// ============================================
// COMPENSATION REVIEW (Support/Finance Manual Decision)
// ============================================

/**
 * Get all payouts pending compensation review
 * These are customer cancellations during prep/delivery stages
 * Support/Finance must decide if garage deserves compensation
 */
export const getPendingCompensationReviews = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query<Record<string, unknown>>(`
            SELECT 
                gp.payout_id,
                gp.order_id,
                gp.garage_id,
                gp.potential_compensation,
                gp.review_reason,
                gp.created_at,
                g.garage_name,
                g.phone_number as garage_phone,
                o.order_number,
                o.customer_id,
                u.full_name as customer_name,
                cr.reason_text,
                cr.order_status_at_cancel,
                cr.time_since_order_minutes
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            JOIN orders o ON gp.order_id = o.order_id
            LEFT JOIN cancellation_requests cr ON gp.order_id = cr.order_id
            LEFT JOIN users u ON o.customer_id = u.user_id
            WHERE gp.payout_status = 'pending_compensation_review'
            ORDER BY gp.created_at DESC
        `);

        res.json({
            success: true,
            reviews: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        logFinanceError('[Finance] getPendingCompensationReviews error:', err);
        res.status(500).json({ error: 'Failed to get pending reviews' });
    }
};

/**
 * Approve garage compensation
 * Garage gets the potential_compensation amount paid out
 */
export const approveCompensation = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const body = req.body as unknown as ApproveCompensationBody;
    const { notes } = body;
    const reviewerId = req.user?.userId;

    try {
        const result = await pool.query<CompensationPayoutRow>(`
            UPDATE garage_payouts 
            SET payout_status = 'pending',
                net_amount = potential_compensation,
                gross_amount = potential_compensation,
                commission_amount = 0,
                adjustment_reason = 'Compensation approved by Support/Finance',
                reviewed_by = $2,
                reviewed_at = NOW(),
                review_notes = $3,
                updated_at = NOW()
            WHERE payout_id = $1 AND payout_status = 'pending_compensation_review'
            RETURNING *
        `, [payout_id, reviewerId, notes || 'Approved']);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found or already reviewed' });
        }

        const payout = result.rows[0];
        const payoutAmount = toOptionalNumber(payout.net_amount) ?? 0;

        // Update cancellation request
        await pool.query(`
            UPDATE cancellation_requests 
            SET garage_compensation = $2,
                compensation_status = 'approved'
            WHERE order_id = $1
        `, [payout.order_id, payoutAmount]);

        // Notify garage
        await createNotification({
            userId: payout.garage_id,
            type: 'compensation_approved',
            title: '✅ Compensation Approved',
            message: `Your compensation of ${payoutAmount.toFixed(2)} QAR has been approved!`,
            data: { payout_id, order_id: payout.order_id, amount: payoutAmount },
            target_role: 'garage'
        });

        logger.info('Compensation approved', { amount: payoutAmount, payoutId: payout_id });
        res.json({ success: true, message: 'Compensation approved', payout: result.rows[0] });
    } catch (err) {
        logFinanceError('[Finance] approveCompensation error:', err);
        res.status(500).json({ error: 'Failed to approve compensation' });
    }
};

/**
 * Deny garage compensation
 * Garage gets $0, payout is cancelled
 * Optional: Apply penalty for garage fault
 */
export const denyCompensation = async (req: AuthRequest, res: Response) => {
    const { payout_id } = req.params;
    const body = req.body as unknown as DenyCompensationBody;
    const { reason, penalty_type } = body;
    const applyPenalty = toOptionalBoolean(body.apply_penalty) ?? false;
    const penaltyAmount = toOptionalNumber(body.penalty_amount);
    const reviewerId = req.user?.userId;

    try {
        const result = await pool.query<CompensationPayoutRow>(`
            UPDATE garage_payouts 
            SET payout_status = 'cancelled',
                cancellation_reason = $2,
                cancelled_at = NOW(),
                reviewed_by = $3,
                reviewed_at = NOW(),
                review_notes = $2,
                updated_at = NOW()
            WHERE payout_id = $1 AND payout_status = 'pending_compensation_review'
            RETURNING *
        `, [payout_id, reason || 'Compensation denied by Support/Finance', reviewerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found or already reviewed' });
        }

        const payout = result.rows[0];

        // Update cancellation request
        await pool.query(`
            UPDATE cancellation_requests 
            SET garage_compensation = 0,
                compensation_status = 'denied'
            WHERE order_id = $1
        `, [payout.order_id]);

        // Apply penalty if requested
        if (applyPenalty && penalty_type && penaltyAmount && penaltyAmount > 0) {
            await pool.query(`
                INSERT INTO garage_penalties (garage_id, order_id, penalty_type, penalty_amount, reason, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `, [payout.garage_id, payout.order_id, penalty_type, penaltyAmount, reason]);

            logger.info('Penalty applied', { penaltyAmount, penaltyType: penalty_type, garageId: payout.garage_id });
        }

        // Notify garage
        await createNotification({
            userId: payout.garage_id,
            type: 'compensation_denied',
            title: '❌ Compensation Denied',
            message: `Compensation request was denied. Reason: ${reason || 'Not specified'}`,
            data: { payout_id, order_id: payout.order_id, reason },
            target_role: 'garage'
        });

        logger.info('Compensation denied', { payoutId: payout_id, reason });
        res.json({ success: true, message: 'Compensation denied', payout: result.rows[0] });
    } catch (err) {
        logFinanceError('[Finance] denyCompensation error:', err);
        res.status(500).json({ error: 'Failed to deny compensation' });
    }
};
