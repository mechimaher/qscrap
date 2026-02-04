/**
 * Bid Flag Controller — Enterprise-Grade Flag + Correction Workflow
 * 
 * Handles:
 * - Customer flagging bids (wrong part, wrong picture, etc.)
 * - Garage acknowledging and correcting flagged bids
 * - Atomic supersede operations with audit trail
 * 
 * @author QScrap Engineering
 * @date February 4, 2026
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { getIO } from '../utils/socketIO';
import { createNotification } from '../services/notification.service';

// ============================================
// Types
// ============================================

interface FlagBidBody {
    reason: 'wrong_part' | 'wrong_picture' | 'incorrect_price' | 'missing_info' | 'other';
    details?: string;
    urgent?: boolean;
}

interface SupersedeBidBody {
    part_condition?: string;
    brand_name?: string;
    part_number?: string;
    warranty_days?: number;
    bid_amount?: number;
    image_urls?: string[];
}

// ============================================
// POST /api/bids/:bid_id/flag
// Customer flags a bid as incorrect
// ============================================
export async function flagBid(req: Request, res: Response): Promise<void> {
    const { bid_id } = req.params;
    const { reason, details, urgent } = req.body as FlagBidBody;
    const customerId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify bid exists and belongs to customer's request
        const bidResult = await client.query(`
            SELECT 
                b.*,
                pr.customer_id,
                pr.part_description,
                g.garage_name,
                g.garage_id,
                u.user_id as garage_user_id
            FROM bids b
            JOIN part_requests pr ON b.request_id = pr.request_id
            JOIN garages g ON b.garage_id = g.garage_id
            JOIN users u ON g.garage_id = u.user_id
            WHERE b.bid_id = $1
        `, [bid_id]);

        if (bidResult.rows.length === 0) {
            res.status(404).json({ error: 'Bid not found' });
            return;
        }

        const bid = bidResult.rows[0];

        // 2. Authorization check
        if (bid.customer_id !== customerId) {
            res.status(403).json({ error: 'Not authorized to flag this bid' });
            return;
        }

        // 3. Status validation
        if (bid.status !== 'pending') {
            res.status(400).json({
                error: 'Can only flag pending bids',
                currentStatus: bid.status
            });
            return;
        }

        // 4. Check for existing pending flag
        const existingFlag = await client.query(`
            SELECT flag_id FROM bid_flags 
            WHERE bid_id = $1 AND status = 'pending'
        `, [bid_id]);

        if (existingFlag.rows.length > 0) {
            res.status(409).json({
                error: 'Bid already has a pending flag',
                existingFlagId: existingFlag.rows[0].flag_id
            });
            return;
        }

        // 5. Create flag record
        const flagResult = await client.query(`
            INSERT INTO bid_flags (bid_id, flagged_by, reason, details, is_urgent)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [bid_id, customerId, reason, details || null, urgent || false]);

        const flag = flagResult.rows[0];

        // 6. Update bid status to flagged
        await client.query(`
            UPDATE bids 
            SET status = 'flagged', updated_at = NOW()
            WHERE bid_id = $1
        `, [bid_id]);

        // 7. Audit log with immutable event reference
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
            VALUES ($1, 'bid_flagged', 'bid', $2, $3)
        `, [customerId, bid_id, JSON.stringify({
            flag_id: flag.flag_id,
            event_id: flag.event_id,
            reason,
            details,
            urgent,
            part_description: bid.part_description
        })]);

        await client.query('COMMIT');

        // 8. Real-time notification to garage
        const io = getIO();
        io?.to(`garage:${bid.garage_id}`).emit('bid:flagged', {
            bidId: bid_id,
            flagId: flag.flag_id,
            reason,
            details,
            urgent: urgent || false,
            requestId: bid.request_id,
            partDescription: bid.part_description,
            originalImages: bid.image_urls,
            timestamp: new Date().toISOString()
        });

        // 9. Push notification
        try {
            const title = urgent ? '🚨 Urgent: Bid Flagged' : '⚠️ Bid Flagged';
            const reasonLabel = reason.replace(/_/g, ' ');

            await createNotification({
                userId: bid.garage_user_id,
                type: 'bid_flagged',
                title,
                message: `Customer flagged your bid: ${reasonLabel}. Tap to review and correct.`,
                data: {
                    bidId: bid_id,
                    flagId: flag.flag_id,
                    urgent: urgent || false
                },
                target_role: 'garage'
            });
        } catch (pushError) {
            console.error('[flagBid] Push notification failed:', pushError);
            // Non-blocking - continue with success response
        }

        // 10. Success response
        res.status(201).json({
            success: true,
            flag: {
                flag_id: flag.flag_id,
                event_id: flag.event_id,
                bid_id,
                reason,
                status: 'pending',
                is_urgent: urgent || false,
                created_at: flag.created_at
            },
            message: 'Bid flagged successfully. The garage has been notified.',
            expectedResponseTime: urgent ? '10 minutes' : '30 minutes'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[flagBid] Error:', error);
        res.status(500).json({ error: 'Failed to flag bid. Please try again.' });
    } finally {
        client.release();
    }
}

// ============================================
// POST /api/bids/:bid_id/supersede
// Garage submits corrected bid version
// ============================================
export async function supersedeBid(req: Request, res: Response): Promise<void> {
    const { bid_id } = req.params;
    const garageId = req.user!.userId;
    const newBidData = req.body as SupersedeBidBody;

    // Handle uploaded images
    const uploadedImages = (req.files as Express.Multer.File[])?.map(f => f.path) || [];
    const imageUrls = uploadedImages.length > 0 ? uploadedImages : newBidData.image_urls;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get original bid with row lock to prevent race conditions
        const originalResult = await client.query(`
            SELECT 
                b.*,
                bf.flag_id,
                bf.flagged_by,
                bf.reason as flag_reason,
                pr.customer_id
            FROM bids b
            LEFT JOIN bid_flags bf ON b.bid_id = bf.bid_id AND bf.status IN ('pending', 'acknowledged')
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE b.bid_id = $1 AND b.garage_id = $2
            FOR UPDATE OF b
        `, [bid_id, garageId]);

        if (originalResult.rows.length === 0) {
            res.status(404).json({ error: 'Bid not found or not owned by you' });
            return;
        }

        const original = originalResult.rows[0];

        // 2. Validate original bid can be superseded
        if (!['pending', 'flagged'].includes(original.status)) {
            res.status(400).json({
                error: 'Cannot supersede this bid',
                currentStatus: original.status,
                allowedStatuses: ['pending', 'flagged']
            });
            return;
        }

        // 3. Calculate new version number
        const newVersion = (original.version_number || 1) + 1;

        // 4. Create new bid version (atomic with marking old as superseded)
        const newBidResult = await client.query(`
            INSERT INTO bids (
                request_id, garage_id, part_condition, brand_name, part_number,
                warranty_days, bid_amount, image_urls, status, supersedes_bid_id,
                version_number, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, NOW(), NOW())
            RETURNING *
        `, [
            original.request_id,
            garageId,
            newBidData.part_condition || original.part_condition,
            newBidData.brand_name || original.brand_name,
            newBidData.part_number || original.part_number,
            newBidData.warranty_days ?? original.warranty_days,
            newBidData.bid_amount || original.bid_amount,
            imageUrls || original.image_urls,
            bid_id,
            newVersion
        ]);

        const newBid = newBidResult.rows[0];

        // 5. Mark original bid as superseded
        await client.query(`
            UPDATE bids 
            SET status = 'superseded', 
                superseded_by = $1, 
                updated_at = NOW()
            WHERE bid_id = $2
        `, [newBid.bid_id, bid_id]);

        // 6. Mark associated flag as corrected
        if (original.flag_id) {
            await client.query(`
                UPDATE bid_flags 
                SET status = 'corrected', updated_at = NOW()
                WHERE flag_id = $1
            `, [original.flag_id]);
        }

        // 7. Audit log
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
            VALUES ($1, 'bid_superseded', 'bid', $2, $3, $4)
        `, [
            garageId,
            bid_id,
            JSON.stringify({
                bid_id: original.bid_id,
                version: original.version_number,
                amount: original.bid_amount,
                flag_reason: original.flag_reason
            }),
            JSON.stringify({
                bid_id: newBid.bid_id,
                version: newVersion,
                amount: newBid.bid_amount
            })
        ]);

        await client.query('COMMIT');

        // 8. Notify customer via socket
        const io = getIO();
        const customerId = original.customer_id || original.flagged_by;

        if (customerId) {
            io?.to(`user:${customerId}`).emit('bid:superseded', {
                originalBidId: bid_id,
                newBidId: newBid.bid_id,
                requestId: original.request_id,
                newAmount: newBid.bid_amount,
                version: newVersion,
                timestamp: new Date().toISOString()
            });

            // Push notification
            try {
                await createNotification({
                    userId: customerId,
                    type: 'bid_superseded',
                    title: '✅ Corrected Bid Received',
                    message: `The garage has submitted a corrected bid (v${newVersion}). Tap to review.`,
                    data: {
                        bidId: newBid.bid_id,
                        requestId: original.request_id
                    },
                    target_role: 'customer'
                });
            } catch (pushError) {
                console.error('[supersedeBid] Push notification failed:', pushError);
            }
        }

        // 9. Success response
        res.status(201).json({
            success: true,
            newBid: {
                bid_id: newBid.bid_id,
                version_number: newVersion,
                bid_amount: newBid.bid_amount,
                part_condition: newBid.part_condition,
                brand_name: newBid.brand_name,
                image_urls: newBid.image_urls,
                status: 'pending',
                supersedes_bid_id: bid_id
            },
            supersededBidId: bid_id,
            message: 'Corrected bid submitted successfully. Customer has been notified.'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[supersedeBid] Error:', error);
        res.status(500).json({ error: 'Failed to submit corrected bid. Please try again.' });
    } finally {
        client.release();
    }
}

// ============================================
// GET /api/bids/flagged
// Get all flagged bids for the current garage
// ============================================
export async function getAllFlaggedBids(req: Request, res: Response): Promise<void> {
    const garageId = req.user!.userId;

    try {
        // Get the garage_id from the user's garage record
        const garageResult = await pool.query(`
            SELECT garage_id FROM garages WHERE user_id = $1
        `, [garageId]);

        if (garageResult.rows.length === 0) {
            res.status(404).json({ error: 'Garage not found' });
            return;
        }

        const garage_id = garageResult.rows[0].garage_id;

        // Get all pending flagged bids for this garage with related info
        const flagsResult = await pool.query(`
            SELECT 
                bf.flag_id,
                bf.bid_id,
                bf.reason,
                bf.details AS customer_note,
                bf.is_urgent,
                bf.status,
                bf.created_at,
                b.bid_amount,
                b.part_condition,
                b.image_urls,
                pr.request_id,
                CONCAT(uc.year, ' ', uc.make, ' ', uc.model) AS car_summary,
                pr.part_name AS part_description,
                u.full_name AS customer_name
            FROM bid_flags bf
            JOIN bids b ON bf.bid_id = b.bid_id
            JOIN part_requests pr ON b.request_id = pr.request_id
            JOIN user_cars uc ON pr.car_id = uc.car_id
            JOIN users u ON bf.flagged_by = u.user_id
            WHERE b.garage_id = $1
            AND bf.status IN ('pending', 'acknowledged')
            ORDER BY bf.is_urgent DESC, bf.created_at ASC
        `, [garage_id]);

        res.json({
            success: true,
            flagged_bids: flagsResult.rows,
            count: flagsResult.rows.length
        });

    } catch (error) {
        console.error('[getAllFlaggedBids] Error:', error);
        res.status(500).json({ error: 'Failed to get flagged bids' });
    }
}

// ============================================
// GET /api/bids/:bid_id/flags
// Get all flags for a bid
// ============================================
export async function getBidFlags(req: Request, res: Response): Promise<void> {
    const { bid_id } = req.params;
    const userId = req.user!.userId;

    try {
        // Verify user has access to this bid
        const accessResult = await pool.query(`
            SELECT b.bid_id
            FROM bids b
            JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE b.bid_id = $1 
            AND (b.garage_id = $2 OR pr.customer_id = $2)
        `, [bid_id, userId]);

        if (accessResult.rows.length === 0) {
            res.status(404).json({ error: 'Bid not found or access denied' });
            return;
        }

        const flagsResult = await pool.query(`
            SELECT 
                bf.*,
                u.full_name as flagged_by_name
            FROM bid_flags bf
            JOIN users u ON bf.flagged_by = u.user_id
            WHERE bf.bid_id = $1
            ORDER BY bf.created_at DESC
        `, [bid_id]);

        res.json({
            bid_id,
            flags: flagsResult.rows,
            count: flagsResult.rows.length
        });

    } catch (error) {
        console.error('[getBidFlags] Error:', error);
        res.status(500).json({ error: 'Failed to get bid flags' });
    }
}

// ============================================
// POST /api/bids/:bid_id/flags/:flag_id/acknowledge
// Garage acknowledges a flag (before correction)
// ============================================
export async function acknowledgeFlag(req: Request, res: Response): Promise<void> {
    const { bid_id, flag_id } = req.params;
    const { message } = req.body;
    const garageId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership and flag exists
        const result = await client.query(`
            UPDATE bid_flags bf
            SET status = 'acknowledged', updated_at = NOW()
            FROM bids b
            WHERE bf.flag_id = $1 
            AND bf.bid_id = $2
            AND b.bid_id = bf.bid_id
            AND b.garage_id = $3
            AND bf.status = 'pending'
            RETURNING bf.*, b.request_id
        `, [flag_id, bid_id, garageId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Flag not found, already processed, or not yours' });
            return;
        }

        const flag = result.rows[0];

        // Audit
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
            VALUES ($1, 'flag_acknowledged', 'bid_flag', $2, $3)
        `, [garageId, flag_id, JSON.stringify({ message })]);

        await client.query('COMMIT');

        // Notify customer
        const io = getIO();
        io?.to(`user:${flag.flagged_by}`).emit('flag:acknowledged', {
            flagId: flag_id,
            bidId: bid_id,
            message: message || 'Garage is reviewing your concern.',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            flag_id,
            status: 'acknowledged',
            message: 'Flag acknowledged. Customer has been notified.'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[acknowledgeFlag] Error:', error);
        res.status(500).json({ error: 'Failed to acknowledge flag' });
    } finally {
        client.release();
    }
}

// ============================================
// POST /api/bids/:bid_id/flags/:flag_id/dismiss
// Customer or garage dismisses a flag
// ============================================
export async function dismissFlag(req: Request, res: Response): Promise<void> {
    const { bid_id, flag_id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify user can dismiss (customer who flagged or garage owner)
        const result = await client.query(`
            UPDATE bid_flags bf
            SET status = 'dismissed', updated_at = NOW()
            FROM bids b
            WHERE bf.flag_id = $1 
            AND bf.bid_id = $2
            AND b.bid_id = bf.bid_id
            AND (bf.flagged_by = $3 OR b.garage_id = $3)
            AND bf.status IN ('pending', 'acknowledged')
            RETURNING bf.*
        `, [flag_id, bid_id, userId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Flag not found or cannot be dismissed' });
            return;
        }

        // Restore bid to pending if it was flagged
        await client.query(`
            UPDATE bids 
            SET status = 'pending', updated_at = NOW()
            WHERE bid_id = $1 AND status = 'flagged'
        `, [bid_id]);

        // Audit
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
            VALUES ($1, 'flag_dismissed', 'bid_flag', $2, $3)
        `, [userId, flag_id, JSON.stringify({ reason })]);

        await client.query('COMMIT');

        res.json({
            success: true,
            flag_id,
            status: 'dismissed',
            message: 'Flag dismissed. Bid restored to pending.'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[dismissFlag] Error:', error);
        res.status(500).json({ error: 'Failed to dismiss flag' });
    } finally {
        client.release();
    }
}

export default {
    flagBid,
    supersedeBid,
    getBidFlags,
    getAllFlaggedBids,
    acknowledgeFlag,
    dismissFlag
};
