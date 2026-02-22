/**
 * Warranty Claims SLA Monitoring Job
 * 
 * Purpose: Auto-escalate warranty claims that have been pending for more than 72 hours
 * 
 * Runs: Every 6 hours via cron
 * Target: Claims with status 'pending_finance_review' older than 72 hours
 * 
 * Actions:
 * 1. Update claim status to 'escalated'
 * 2. Notify Finance team via notification
 * 3. Emit Socket.IO event for real-time dashboard alert
 */

import { Pool } from 'pg';
import { createNotification } from '../services/notification.service';
import { getIO } from '../utils/socketIO';
import logger from '../utils/logger';

const SLA_THRESHOLD_HOURS = 72; // 72 hours = 3 days

export interface SlaJobResult {
    escalated_count: number;
    claims: EscalatedClaim[];
}

export interface EscalatedClaim {
    claim_id: string;
    order_number: string;
    garage_name: string;
    garage_id: string;
    customer_id: string;
    hours_pending: number;
}

/**
 * Auto-escalate warranty claims pending for more than 72 hours
 */
export async function runWarrantyClaimsSlaJob(pool: Pool): Promise<SlaJobResult> {
    try {
        // Find claims breaching SLA
        const staleClaimsResult = await pool.query(`
            SELECT 
                wc.claim_id,
                o.order_number,
                g.garage_name,
                ROUND(EXTRACT(EPOCH FROM (NOW() - wc.created_at)) / 3600, 1) as hours_pending,
                wc.customer_id,
                wc.garage_id
            FROM warranty_claims wc
            INNER JOIN orders o ON o.order_id = wc.order_id
            INNER JOIN garages g ON g.garage_id = wc.garage_id
            WHERE wc.claim_status = 'pending_finance_review'
            AND wc.created_at < NOW() - INTERVAL '${SLA_THRESHOLD_HOURS} hours'
            ORDER BY hours_pending DESC
            LIMIT 20
        `);

        const staleClaims = staleClaimsResult.rows as unknown as EscalatedClaim[];

        if (staleClaims.length === 0) {
            logger.info('[WARRANTY-SLA] No claims breaching SLA');
            return { escalated_count: 0, claims: [] };
        }

        logger.info(`[WARRANTY-SLA] Found ${staleClaims.length} claims breaching ${SLA_THRESHOLD_HOURS}h SLA`);

        const escalatedClaims: EscalatedClaim[] = [];

        // Process each claim
        for (const claim of staleClaims) {
            try {
                const client = await pool.connect();
                
                try {
                    await client.query('BEGIN');

                    // Update claim status to escalated
                    await client.query(`
                        UPDATE warranty_claims
                        SET 
                            claim_status = 'escalated',
                            updated_at = NOW(),
                            resolution_notes = COALESCE(resolution_notes, '') || 
                                ' [AUTO-ESCALATED: Pending > ' || ${SLA_THRESHOLD_HOURS} || 'h]'
                        WHERE claim_id = $1
                        RETURNING *
                    `, [claim.claim_id]);

                    await client.query('COMMIT');

                    escalatedClaims.push(claim);

                    logger.info(`[WARRANTY-SLA] Escalated claim ${claim.claim_id} (${claim.order_number}) - ${claim.hours_pending}h pending`);
                } catch (err) {
                    await client.query('ROLLBACK');
                    logger.error(`[WARRANTY-SLA] Failed to escalate claim ${claim.claim_id}`, { 
                        error: (err as Error).message 
                    });
                } finally {
                    client.release();
                }

                // Send notification to Finance team
                try {
                    await createNotification({
                        userId: 'finance_team',
                        target_role: 'operations',
                        type: 'warranty_claim_escalated',
                        title: '⚠️ Warranty Claim Escalated (SLA Breach)',
                        message: `Order #${claim.order_number}: Claim pending for ${claim.hours_pending}h (> ${SLA_THRESHOLD_HOURS}h SLA). Immediate attention required.`,
                        data: {
                            claim_id: claim.claim_id,
                            order_id: claim.order_number,
                            hours_pending: claim.hours_pending,
                            garage_id: claim.garage_id,
                            garage_name: claim.garage_name
                        }
                    });
                } catch (notifyErr) {
                    logger.warn('[WARRANTY-SLA] Failed to send escalation notification', { 
                        error: (notifyErr as Error).message 
                    });
                }
            } catch (err) {
                logger.error(`[WARRANTY-SLA] Error processing claim ${claim.claim_id}`, { 
                    error: (err as Error).message 
                });
            }
        }

        // Emit Socket.IO event for real-time dashboard alert
        const io = getIO();
        if (io && escalatedClaims.length > 0) {
            io.to('operations').emit('warranty_claims_escalated', {
                count: escalatedClaims.length,
                claims: escalatedClaims,
                sla_threshold_hours: SLA_THRESHOLD_HOURS,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`[WARRANTY-SLA] Job completed. Escalated ${escalatedClaims.length} claims.`);

        return {
            escalated_count: escalatedClaims.length,
            claims: escalatedClaims
        };
    } catch (err) {
        logger.error('[WARRANTY-SLA] Job failed', { error: (err as Error).message });
        throw err;
    }
}

/**
 * Manual trigger for testing
 */
export async function runWarrantyClaimsSlaJobNow(pool: Pool): Promise<SlaJobResult> {
    return runWarrantyClaimsSlaJob(pool);
}

/**
 * Get SLA breach statistics (for monitoring dashboard)
 */
export async function getSlaBreachStats(pool: Pool): Promise<{
    total_pending: number;
    at_risk_48h: number;
    breached_72h: number;
    avg_pending_time_hours: number;
}> {
    const result = await pool.query(`
        SELECT 
            COUNT(*) FILTER (WHERE claim_status = 'pending_finance_review') as total_pending,
            COUNT(*) FILTER (
                WHERE claim_status = 'pending_finance_review' 
                AND created_at > NOW() - INTERVAL '72 hours'
                AND created_at < NOW() - INTERVAL '48 hours'
            ) as at_risk_48h,
            COUNT(*) FILTER (
                WHERE claim_status = 'pending_finance_review' 
                AND created_at < NOW() - INTERVAL '72 hours'
            ) as breached_72h,
            ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)) as avg_pending_time_hours
        FROM warranty_claims
        WHERE claim_status = 'pending_finance_review'
    `);

    const stats = result.rows[0];

    return {
        total_pending: parseInt(stats.total_pending) || 0,
        at_risk_48h: parseInt(stats.at_risk_48h) || 0,
        breached_72h: parseInt(stats.breached_72h) || 0,
        avg_pending_time_hours: parseFloat(stats.avg_pending_time_hours) || 0
    };
}
