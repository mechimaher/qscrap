/**
 * GarageApprovalService - Garage Approval Workflow
 * Handles garage onboarding, demo access, and approval lifecycle
 */

import { Pool, PoolClient } from 'pg';
import {
    GarageFilters,
    PaginatedGarages,
    Garage,
    DemoResult
} from './types';
import {
    GarageNotFoundError,
    GarageAlreadyProcessedError,
    InvalidApprovalStatusError
} from './errors';
import { emailService } from '../email.service';
import logger from '../../utils/logger';

const DEMO_PERIOD_DAYS = 30;

export class GarageApprovalService {
    constructor(private pool: Pool) { }

    /**
     * Get garages with filters and pagination
     */
    async getPendingGarages(filters: GarageFilters): Promise<PaginatedGarages> {
        const {
            approval_status = 'pending',
            search,
            page = 1,
            limit = 12
        } = filters;

        const pageNum = Math.max(1, page);
        const limitNum = Math.min(50, Math.max(1, limit));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        // Status filter
        if (approval_status && approval_status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            params.push(approval_status);
        }

        // Search filter
        if (search) {
            whereClause += ` AND (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await this.pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.created_at as registration_date,
                u.is_active,
                u.is_suspended,
                CASE 
                    WHEN g.demo_expires_at IS NOT NULL THEN 
                        EXTRACT(DAYS FROM (g.demo_expires_at - NOW()))::int
                    ELSE NULL 
                END as demo_days_left
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            ${whereClause}
            ORDER BY g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limitNum, offset]);

        return {
            garages: result.rows,
            pagination: {
                current_page: pageNum,
                total_pages: Math.ceil(total / limitNum),
                total,
                limit: limitNum
            }
        };
    }

    /**
     * Get all garages with subscription info (admin view)
     */
    async getAllGarages(filters: GarageFilters): Promise<PaginatedGarages> {
        const { approval_status, search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (approval_status && approval_status !== 'all') {
            whereClause += ` AND g.approval_status = $${paramIndex++}`;
            params.push(approval_status);
        }

        if (search) {
            whereClause += ` AND (g.garage_name ILIKE $${paramIndex} OR u.phone_number ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM garages g JOIN users u ON g.garage_id = u.user_id ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await this.pool.query(`
            SELECT 
                g.*,
                u.phone_number,
                u.email,
                u.full_name,
                u.is_active,
                u.is_suspended,
                CASE 
                    -- Priority 1: If garage is in demo status, always show Demo Trial
                    WHEN g.approval_status = 'demo' THEN 'Demo Trial'
                    -- Priority 2: If garage has an active paid subscription, show that plan
                    WHEN active_sp.plan_name IS NOT NULL AND active_sp.plan_code NOT IN ('free', 'demo') THEN active_sp.plan_name
                    -- Priority 3: Fallback to current_plan_code
                    WHEN g.current_plan_code = 'free' THEN 'Pay-Per-Sale'
                    WHEN g.current_plan_code = 'starter' THEN 'Starter'
                    WHEN g.current_plan_code = 'gold' THEN 'Gold Partner'
                    WHEN g.current_plan_code = 'platinum' THEN 'Platinum Partner'
                    ELSE 'Pay-Per-Sale'
                END as plan_name,
                (SELECT COUNT(*) FROM orders WHERE garage_id = g.garage_id) as total_orders,
                (SELECT COUNT(*) FROM bids WHERE garage_id = g.garage_id) as total_bids
            FROM garages g
            JOIN users u ON g.garage_id = u.user_id
            LEFT JOIN garage_subscriptions gs ON g.garage_id = gs.garage_id 
                AND gs.status IN ('active', 'trial', 'past_due')
            LEFT JOIN subscription_plans active_sp ON gs.plan_id = active_sp.plan_id
            ${whereClause}
            ORDER BY g.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, [...params, limit, offset]);

        return {
            garages: result.rows,
            pagination: {
                current_page: page,
                total_pages: Math.ceil(total / limit),
                total,
                limit
            }
        };
    }

    /**
     * Approve a garage application
     */
    async approveGarage(garageId: string, adminId: string, notes?: string): Promise<Garage> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const garageResult = await client.query(`
                UPDATE garages SET
                    approval_status = 'approved',
                    approval_date = NOW(),
                    approved_by = $1,
                    admin_notes = $2,
                    updated_at = NOW()
                WHERE garage_id = $3
                RETURNING *
            `, [adminId, notes || 'Approved by admin', garageId]);

            if (garageResult.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            // Activate user account and clear any suspension
            await client.query(`
                UPDATE users SET 
                    is_active = true, 
                    is_suspended = false, 
                    suspension_reason = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'approve_garage', garageId, {
                status: 'approved',
                notes
            });

            await client.query('COMMIT');

            // Send welcome email (after commit, non-blocking)
            const garage = garageResult.rows[0];
            try {
                // Fetch user email and phone
                const userResult = await this.pool.query(`
                    SELECT email, phone_number FROM users WHERE user_id = $1
                `, [garageId]);

                if (userResult.rows.length > 0 && userResult.rows[0].email) {
                    const { email, phone_number } = userResult.rows[0];
                    const planName = garage.current_plan_code === 'free' ? 'Pay-Per-Sale (Free)' :
                        garage.current_plan_code || 'Pay-Per-Sale (Free)';

                    await emailService.sendGarageApprovalEmail(
                        email,
                        garage.garage_name,
                        phone_number,
                        planName
                    );
                    logger.info('Welcome email sent', { email });
                }
            } catch (emailErr: any) {
                // Log but don't fail the approval
                logger.error('Failed to send welcome email', { error: emailErr.message });
            }

            return garage;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a garage application
     */
    async rejectGarage(garageId: string, adminId: string, reason: string): Promise<Garage> {
        if (!reason) {
            throw new Error('Rejection reason is required');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'rejected',
                    rejection_reason = $1,
                    updated_at = NOW()
                WHERE garage_id = $2
                RETURNING *
            `, [reason, garageId]);

            if (result.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            // Deactivate user
            await client.query(`
                UPDATE users SET is_active = false, updated_at = NOW()
                WHERE user_id = $1
            `, [garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'reject_garage', garageId, {
                status: 'rejected',
                reason
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
     * Grant demo access (30-day trial)
     */
    async grantDemoAccess(
        garageId: string,
        adminId: string,
        days: number = DEMO_PERIOD_DAYS,
        notes?: string
    ): Promise<DemoResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);

            // Cancel any active paid subscriptions
            await client.query(`
                UPDATE garage_subscriptions 
                SET status = 'cancelled', 
                    cancelled_at = NOW(),
                    cancellation_reason = 'Downgraded to demo by admin',
                    updated_at = NOW()
                WHERE garage_id = $1 AND status IN ('active', 'trial')
            `, [garageId]);

            // Get the free (demo) plan
            const freePlan = await client.query(`
                SELECT plan_id FROM subscription_plans WHERE plan_code = 'free' AND is_active = true
            `);
            const planId = freePlan.rows[0]?.plan_id;

            // Update garage to demo with plan code
            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'demo',
                    current_plan_code = 'free',
                    demo_expires_at = $1,
                    approved_by = $2,
                    admin_notes = $3,
                    updated_at = NOW()
                WHERE garage_id = $4
                RETURNING *
            `, [expiryDate, adminId, notes || `Demo access for ${days} days`, garageId]);

            if (result.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            // Create subscription record with the free plan
            if (planId) {
                await client.query(`
                    INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, next_billing_date)
                    VALUES ($1, $2, 'trial', NOW(), $3, $3)
                    ON CONFLICT (garage_id) DO UPDATE SET 
                        plan_id = EXCLUDED.plan_id, 
                        status = 'trial',
                        billing_cycle_start = NOW(),
                        billing_cycle_end = EXCLUDED.billing_cycle_end,
                        updated_at = NOW()
                `, [garageId, planId, expiryDate]);
            }

            // Activate user and clear any suspension
            await client.query(`
                UPDATE users SET 
                    is_active = true, 
                    is_suspended = false, 
                    suspension_reason = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'grant_demo', garageId, {
                days,
                expires_at: expiryDate,
                notes
            });

            await client.query('COMMIT');

            // Send welcome email (after commit, non-blocking)
            const garage = result.rows[0];
            try {
                const userResult = await this.pool.query(`
                    SELECT email, phone_number FROM users WHERE user_id = $1
                `, [garageId]);

                if (userResult.rows.length > 0 && userResult.rows[0].email) {
                    const { email, phone_number } = userResult.rows[0];
                    await emailService.sendGarageApprovalEmail(
                        email,
                        garage.garage_name,
                        phone_number,
                        `Demo Trial (${days} days free)`
                    );
                    logger.info('Demo welcome email sent', { email });
                }
            } catch (emailErr: any) {
                logger.error('Failed to send demo email', { error: emailErr.message });
            }

            return {
                garage,
                expires_at: expiryDate,
                message: `Demo access granted for ${days} days`
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Revoke garage access (suspend)
     */
    async revokeGarageAccess(garageId: string, adminId: string, reason: string): Promise<Garage> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Get current status for audit
            const currentStatus = await client.query(
                'SELECT approval_status FROM garages WHERE garage_id = $1',
                [garageId]
            );

            const result = await client.query(`
                UPDATE garages SET
                    approval_status = 'pending',
                    rejection_reason = $1,
                    updated_at = NOW()
                WHERE garage_id = $2
                RETURNING *
            `, [reason || 'Access revoked by admin', garageId]);

            if (result.rows.length === 0) {
                throw new GarageNotFoundError(garageId);
            }

            // Suspend user
            await client.query(`
                UPDATE users SET
                    is_suspended = true,
                    suspension_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2
            `, [reason || 'Access revoked', garageId]);

            // Log action
            await this.logAdminAction(client, adminId, 'revoke_access', garageId, {
                old_status: currentStatus.rows[0]?.approval_status,
                new_status: 'pending',
                reason
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
     * Log admin action for audit trail
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
