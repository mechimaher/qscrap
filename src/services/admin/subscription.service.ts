/**
 * SubscriptionManagementService - Subscription & Plan Management
 * Handles plan assignments, subscription lifecycle, and commission overrides
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import {
    SubscriptionRequest,
    Plan,
    Subscription,
    AssignPlanParams,
    SpecializationData
} from './types';
import {
    PlanNotFoundError,
    SubscriptionNotFoundError,
    RequestAlreadyProcessedError,
    InvalidCommissionRateError,
    GarageNotFoundError
} from './errors';

export class SubscriptionManagementService {
    constructor(private pool: Pool) { }

    /**
     * Get subscription change requests
     */
    async getSubscriptionRequests(status: string = 'pending'): Promise<SubscriptionRequest[]> {
        const result = await this.pool.query(`
            SELECT scr.*, 
                   g.garage_name, u.phone_number,
                   fp.plan_name as from_plan_name,
                   tp.plan_name as to_plan_name,
                   tp.monthly_fee as new_fee
            FROM subscription_change_requests scr
            JOIN garages g ON scr.garage_id = g.garage_id
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN subscription_plans fp ON scr.from_plan_id = fp.plan_id
            JOIN subscription_plans tp ON scr.to_plan_id = tp.plan_id
            WHERE scr.status = $1
            ORDER BY scr.created_at ASC
        `, [status]);

        return result.rows;
    }

    /**
     * Approve subscription change request
     */
    async approveSubscriptionRequest(requestId: string, adminId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Fetch request
            const reqQuery = await client.query(`
                SELECT * FROM subscription_change_requests 
                WHERE request_id = $1 AND status = 'pending' 
                FOR UPDATE
            `, [requestId]);

            if (reqQuery.rows.length === 0) {
                throw new RequestAlreadyProcessedError(requestId, 'processed or not found');
            }

            const subReq = reqQuery.rows[0];

            // Update subscription
            await client.query(`
                UPDATE garage_subscriptions 
                SET plan_id = $1, next_plan_id = NULL, updated_at = NOW()
                WHERE garage_id = $2 AND status IN ('active', 'trial')
            `, [subReq.to_plan_id, subReq.garage_id]);

            // Mark request approved
            await client.query(`
                UPDATE subscription_change_requests
                SET status = 'approved', processed_by = $1, updated_at = NOW()
                WHERE request_id = $2
            `, [adminId, requestId]);

            // Log action
            await this.logAdminAction(client, adminId, 'approve_sub_change', subReq.garage_id, {
                request_id: requestId,
                to_plan: subReq.to_plan_id
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject subscription change request
     */
    async rejectSubscriptionRequest(requestId: string, adminId: string, reason?: string): Promise<void> {
        await this.pool.query(`
            UPDATE subscription_change_requests
            SET status = 'rejected', admin_notes = $1, processed_by = $2, updated_at = NOW()
            WHERE request_id = $3
        `, [reason || 'Rejected by admin', adminId, requestId]);
    }

    /**
     * Get all subscription plans
     */
    async getSubscriptionPlans(): Promise<Plan[]> {
        const result = await this.pool.query(`
            SELECT sp.*,
                   (SELECT COUNT(*) FROM garage_subscriptions gs 
                    WHERE gs.plan_id = sp.plan_id AND gs.status = 'active') as active_count
            FROM subscription_plans sp
            WHERE sp.is_active = true
            ORDER BY sp.display_order ASC
        `);

        return result.rows;
    }

    /**
     * Assign plan to garage (admin override - promotes from demo)
     */
    async assignPlanToGarage(
        garageId: string,
        planId: string,
        adminId: string,
        params: AssignPlanParams
    ): Promise<Subscription> {
        const { months = 1, notes } = params;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify plan exists
            const planCheck = await client.query(
                'SELECT * FROM subscription_plans WHERE plan_id = $1',
                [planId]
            );

            if (planCheck.rows.length === 0) {
                throw new PlanNotFoundError(parseInt(planId));
            }

            const plan = planCheck.rows[0];

            // Cancel existing subscriptions
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garageId]);

            // Promote garage to approved
            await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    demo_expires_at = NULL,
                    approved_by = $1,
                    approval_date = NOW(),
                    updated_at = NOW()
                WHERE garage_id = $2
            `, [adminId, garageId]);

            // Activate user
            await client.query(`
                UPDATE users SET
                    is_active = true,
                    is_suspended = false,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garageId]);

            // Create subscription
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + months);

            const subResult = await client.query(`
                INSERT INTO garage_subscriptions 
                (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, is_admin_granted, admin_notes)
                VALUES ($1, $2, 'active', $3, $4, true, $5)
                RETURNING *
            `, [garageId, planId, startDate, endDate, notes || 'Granted by admin']);

            // Log action
            await this.logAdminAction(client, adminId, 'assign_plan', garageId, {
                plan_id: planId,
                plan_name: plan.plan_name,
                months,
                end_date: endDate
            });

            await client.query('COMMIT');
            return subResult.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Revoke/cancel garage subscription
     */
    async revokeSubscription(garageId: string, adminId: string, reason?: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const currentSub = await client.query(`
                SELECT gs.*, sp.plan_name 
                FROM garage_subscriptions gs
                JOIN subscription_plans sp ON gs.plan_id = sp.plan_id
                WHERE gs.garage_id = $1 AND gs.status IN ('active', 'trial')
            `, [garageId]);

            if (currentSub.rows.length === 0) {
                throw new SubscriptionNotFoundError(garageId);
            }

            await client.query(`
                UPDATE garage_subscriptions
                SET status = 'cancelled',
                    cancelled_at = NOW(),
                    cancellation_reason = $1,
                    updated_at = NOW()
                WHERE garage_id = $2 AND status IN ('active', 'trial')
            `, [reason || 'Cancelled by admin', garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'revoke_subscription', garageId, {
                plan_name: currentSub.rows[0].plan_name,
                reason
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Extend subscription billing cycle
     */
    async extendSubscription(
        garageId: string,
        months: number,
        adminId: string,
        notes?: string
    ): Promise<Subscription> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garage_subscriptions
                SET billing_cycle_end = billing_cycle_end + INTERVAL '${months} months',
                    admin_notes = COALESCE($1, admin_notes),
                    updated_at = NOW()
                WHERE garage_id = $2 AND status IN ('active', 'trial')
                RETURNING *
            `, [notes, garageId]);

            if (result.rows.length === 0) {
                throw new SubscriptionNotFoundError(garageId);
            }

            // Log action
            await this.logAdminAction(client, adminId, 'extend_subscription', garageId, {
                months,
                new_end_date: result.rows[0].billing_cycle_end,
                notes
            });

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Override commission rate for specific garage
     */
    async overrideCommission(
        garageId: string,
        commissionRate: number,
        adminId: string,
        reason: string
    ): Promise<void> {
        if (commissionRate < 0 || commissionRate > 100) {
            throw new InvalidCommissionRateError(commissionRate);
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current rate for audit
            const current = await client.query(
                'SELECT commission_rate FROM garages WHERE garage_id = $1',
                [garageId]
            );

            if (current.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            await client.query(`
                UPDATE garages
                SET commission_rate = $1, updated_at = NOW()
                WHERE garage_id = $2
            `, [commissionRate, garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'override_commission', garageId, {
                old_rate: current.rows[0].commission_rate,
                new_rate: commissionRate,
                reason
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Update garage specialization (supplier type & brands)
     */
    async updateGarageSpecialization(
        garageId: string,
        adminId: string,
        data: SpecializationData
    ): Promise<any> {
        const { supplier_type, specialized_brands, all_brands } = data;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garages
                SET supplier_type = $1,
                    specialized_brands = $2,
                    all_brands = $3,
                    updated_at = NOW()
                WHERE garage_id = $4
                RETURNING *
            `, [supplier_type, specialized_brands || null, all_brands || false, garageId]);

            if (result.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            // Log action
            await this.logAdminAction(client, adminId, 'update_specialization', garageId, {
                supplier_type,
                specialized_brands,
                all_brands
            });

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Log admin action
     */
    private async logAdminAction(
        client: PoolClient,
        adminId: string,
        actionType: string,
        targetId: string,
        data: any
    ): Promise<void> {
        await client.query(`
            INSERT INTO admin_audit_log (admin_id, action_type, target_type, target_id, new_value)
            VALUES ($1, $2, 'garage', $3, $4)
        `, [adminId, actionType, targetId, JSON.stringify(data)]);
    }
}
