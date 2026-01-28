/**
 * Account Deletion Service
 * Enterprise-grade deletion eligibility checking
 * Google Play 2026 Compliant
 */

import { Pool } from 'pg';

export interface DeletionBlocker {
    type: 'active_orders' | 'open_tickets' | 'active_disputes' | 'pending_refunds' | 'active_requests';
    count: number;
    message: string;
    action: 'view_orders' | 'view_support' | 'contact_support' | 'view_requests';
}

export interface DeletionEligibilityResult {
    canDelete: boolean;
    blockers: DeletionBlocker[];
}

export class AccountDeletionService {
    constructor(private pool: Pool) { }

    /**
     * Check if a user account can be deleted
     * Returns blockers if there are any pending business items
     */
    async checkDeletionEligibility(userId: string): Promise<DeletionEligibilityResult> {
        const blockers: DeletionBlocker[] = [];

        // 1. Check for active orders (paid, processing, shipped, out_for_delivery)
        const activeOrdersResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM orders 
             WHERE customer_id = $1 
             AND order_status IN ('paid', 'confirmed', 'processing', 'ready_for_pickup', 
                           'picked_up', 'in_transit', 'out_for_delivery')`,
            [userId]
        );
        const activeOrdersCount = parseInt(activeOrdersResult.rows[0].count, 10);
        if (activeOrdersCount > 0) {
            blockers.push({
                type: 'active_orders',
                count: activeOrdersCount,
                message: activeOrdersCount === 1
                    ? 'You have 1 order in progress'
                    : `You have ${activeOrdersCount} orders in progress`,
                action: 'view_orders'
            });
        }

        // 2. Check for open support tickets
        const openTicketsResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM support_tickets 
             WHERE customer_id = $1 
             AND status IN ('open', 'in_progress')`,
            [userId]
        );
        const openTicketsCount = parseInt(openTicketsResult.rows[0].count, 10);
        if (openTicketsCount > 0) {
            blockers.push({
                type: 'open_tickets',
                count: openTicketsCount,
                message: openTicketsCount === 1
                    ? 'You have 1 open support ticket'
                    : `You have ${openTicketsCount} open support tickets`,
                action: 'view_support'
            });
        }

        // 3. Check for active disputes
        const activeDisputesResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM disputes 
             WHERE customer_id = $1 
             AND status IN ('pending', 'open', 'under_review', 'awaiting_response')`,
            [userId]
        );
        const activeDisputesCount = parseInt(activeDisputesResult.rows[0].count, 10);
        if (activeDisputesCount > 0) {
            blockers.push({
                type: 'active_disputes',
                count: activeDisputesCount,
                message: activeDisputesCount === 1
                    ? 'You have 1 pending dispute'
                    : `You have ${activeDisputesCount} pending disputes`,
                action: 'contact_support'
            });
        }

        // 4. Check for pending refunds
        const pendingRefundsResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM refunds 
             WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id = $1)
             AND refund_status IN ('pending', 'processing')`,
            [userId]
        );
        const pendingRefundsCount = parseInt(pendingRefundsResult.rows[0].count, 10);
        if (pendingRefundsCount > 0) {
            blockers.push({
                type: 'pending_refunds',
                count: pendingRefundsCount,
                message: pendingRefundsCount === 1
                    ? 'You have 1 pending refund'
                    : `You have ${pendingRefundsCount} pending refunds`,
                action: 'contact_support'
            });
        }

        // 5. Check for active requests with bids (customer should respond or cancel)
        const activeRequestsResult = await this.pool.query(
            `SELECT COUNT(DISTINCT r.request_id) as count 
             FROM part_requests r
             LEFT JOIN bids b ON r.request_id = b.request_id AND b.status = 'pending'
             WHERE r.customer_id = $1 
             AND r.status = 'active'
             AND b.bid_id IS NOT NULL`,
            [userId]
        );
        const activeRequestsCount = parseInt(activeRequestsResult.rows[0].count, 10);
        if (activeRequestsCount > 0) {
            blockers.push({
                type: 'active_requests',
                count: activeRequestsCount,
                message: activeRequestsCount === 1
                    ? 'You have 1 active request with pending bids'
                    : `You have ${activeRequestsCount} active requests with pending bids`,
                action: 'view_requests'
            });
        }

        return {
            canDelete: blockers.length === 0,
            blockers
        };
    }
}
