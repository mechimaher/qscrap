/**
 * PayoutService - Facade for Payout Operations
 * Re-exports from specialized sub-services for backwards compatibility
 * 
 * Decomposed into:
 * - PayoutLifecycleService: 2-way confirmation workflow
 * - PayoutQueryService: Read operations
 * - PayoutAdminService: Admin/operations management
 * - PayoutHelpers: Shared utilities
 */

import { Pool } from 'pg';
import { PayoutLifecycleService } from './payout-lifecycle.service';
import { PayoutQueryService } from './payout-query.service';
import { PayoutAdminService } from './payout-admin.service';
import {
    SendPaymentDto,
    ConfirmPaymentDto,
    DisputeDto,
    ResolveDisputeDto,
    PayoutFilters,
    PayoutResult,
    BulkConfirmResult,
    PayoutSummary,
    PaginatedPayouts,
    PayoutStatusDetail,
    PaymentStats,
    Payout,
    BatchPaymentDto,
    BatchPaymentResult,
    BatchPaymentPreview,
    GarageWithPendingPayouts,
    PayoutStatementParams,
    PayoutStatementData
} from './types';

/**
 * PayoutService - Unified Facade
 * Delegates to specialized sub-services
 */
export class PayoutService {
    private lifecycle: PayoutLifecycleService;
    private query: PayoutQueryService;
    private admin: PayoutAdminService;

    constructor(private pool: Pool) {
        this.lifecycle = new PayoutLifecycleService(pool);
        this.query = new PayoutQueryService(pool);
        this.admin = new PayoutAdminService(pool);
    }

    // ============================================
    // LIFECYCLE OPERATIONS (2-Way Confirmation)
    // ============================================

    async sendPayment(payoutId: string, details: SendPaymentDto): Promise<PayoutResult> {
        return this.lifecycle.sendPayment(payoutId, details);
    }

    async confirmPayment(
        payoutId: string,
        garageId: string,
        details: ConfirmPaymentDto
    ): Promise<PayoutResult> {
        return this.lifecycle.confirmPayment(payoutId, garageId, details);
    }

    async disputePayment(
        payoutId: string,
        garageId: string,
        dispute: DisputeDto
    ): Promise<PayoutResult> {
        return this.lifecycle.disputePayment(payoutId, garageId, dispute);
    }

    async resolveDispute(
        payoutId: string,
        resolution: ResolveDisputeDto
    ): Promise<PayoutResult> {
        return this.lifecycle.resolveDispute(payoutId, resolution);
    }

    async confirmAllPayouts(garageId: string, password: string): Promise<BulkConfirmResult> {
        return this.lifecycle.confirmAllPayouts(garageId, password);
    }

    async sendReminder(payoutId: string): Promise<{ success: boolean; message: string }> {
        return this.lifecycle.sendReminder(payoutId);
    }

    // ============================================
    // QUERY OPERATIONS
    // ============================================

    async getPayoutSummary(userId: string, userType: string): Promise<PayoutSummary> {
        return this.query.getPayoutSummary(userId, userType);
    }

    async getAwaitingConfirmation(garageId: string): Promise<Payout[]> {
        return this.query.getAwaitingConfirmation(garageId);
    }

    async getPayouts(filters: PayoutFilters): Promise<PaginatedPayouts> {
        return this.query.getPayouts(filters);
    }

    async getPayoutStatus(payoutId: string): Promise<PayoutStatusDetail> {
        return this.query.getPayoutStatus(payoutId);
    }

    async getPaymentStats(): Promise<PaymentStats> {
        return this.query.getPaymentStats();
    }

    async getInWarrantyPayouts(userType: string, userId?: string): Promise<Payout[]> {
        return this.query.getInWarrantyPayouts(userType, userId);
    }

    // ============================================
    // ADMIN OPERATIONS
    // ============================================

    async processPayout(payoutId: string): Promise<void> {
        return this.admin.processPayout(payoutId);
    }

    async holdPayout(payoutId: string, reason: string): Promise<void> {
        return this.admin.holdPayout(payoutId, reason);
    }

    async releasePayout(payoutId: string): Promise<void> {
        return this.admin.releasePayout(payoutId);
    }

    async forceProcessPayout(payoutId: string, reason: string): Promise<PayoutResult> {
        return this.admin.forceProcessPayout(payoutId, reason);
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    async getBatchPayoutPreview(params: {
        payout_ids?: string[];
        garage_id?: string;
        all_pending?: boolean;
    }): Promise<BatchPaymentPreview> {
        return this.admin.getBatchPayoutPreview(params);
    }

    async sendBatchPayments(
        dto: BatchPaymentDto,
        sentBy: string
    ): Promise<BatchPaymentResult> {
        return this.admin.sendBatchPayments(dto, sentBy);
    }

    async getGaragesWithPendingPayouts(): Promise<{ garages: GarageWithPendingPayouts[] }> {
        return this.admin.getGaragesWithPendingPayouts();
    }

    // ============================================
    // PAYOUT STATEMENTS
    // ============================================

    async generatePayoutStatement(params: PayoutStatementParams): Promise<PayoutStatementData> {
        return this.admin.generatePayoutStatement(params);
    }

    // ============================================
    // STATIC (for cron jobs)
    // ============================================

    static async autoConfirmPayouts(pool: Pool): Promise<{ confirmed: number; failed: number }> {
        return PayoutAdminService.autoConfirmPayouts(pool);
    }
}

// Re-export sub-services for direct access
export { PayoutLifecycleService } from './payout-lifecycle.service';
export { PayoutQueryService } from './payout-query.service';
export { PayoutAdminService } from './payout-admin.service';
export { PayoutHelpers } from './payout-helpers';
