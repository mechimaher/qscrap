import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { readPool, writePool } from '../config/db';
import { getErrorMessage } from '../types';
import { emitToUser, emitToGarage } from '../utils/socketIO';

// ============================================
// REPAIR MARKETPLACE CONTROLLER
// Customer repair requests, workshop bids, bookings
// ============================================

// ============================================
// CUSTOMER: CREATE REPAIR REQUEST
// ============================================

export async function createRepairRequest(req: AuthRequest, res: Response) {
    try {
        const customer_id = req.user?.user_id;
        if (!customer_id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const {
            car_make,
            car_model,
            car_year,
            vin_number,
            saved_vehicle_id,
            problem_type,
            problem_description,
            urgency,
            image_urls,
            video_urls,
            audio_urls,
            customer_lat,
            customer_lng,
            customer_address,
            service_location
        } = req.body;

        if (!car_make || !car_model || !problem_description) {
            return res.status(400).json({ error: 'Car make, model, and problem description required' });
        }

        const result = await writePool.query(`
            INSERT INTO repair_requests (
                customer_id, car_make, car_model, car_year, vin_number, saved_vehicle_id,
                problem_type, problem_description, urgency,
                image_urls, video_urls, audio_urls,
                customer_lat, customer_lng, customer_address, service_location
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING request_id, created_at
        `, [
            customer_id, car_make, car_model, car_year || null, vin_number || null, saved_vehicle_id || null,
            problem_type || 'general', problem_description, urgency || 'normal',
            image_urls || [], video_urls || [], audio_urls || [],
            customer_lat || null, customer_lng || null, customer_address || null, service_location || 'workshop'
        ]);

        const request = result.rows[0];

        // TODO: Notify nearby workshops via WebSocket/push

        res.status(201).json({
            message: 'Repair request created successfully',
            request_id: request.request_id,
            created_at: request.created_at
        });
    } catch (err) {
        console.error('Create repair request error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// CUSTOMER: GET MY REPAIR REQUESTS
// ============================================

export async function getMyRepairRequests(req: AuthRequest, res: Response) {
    try {
        const customer_id = req.user?.user_id;
        if (!customer_id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await readPool.query(`
            SELECT 
                r.*,
                (SELECT COUNT(*) FROM repair_bids WHERE request_id = r.request_id) as bid_count
            FROM repair_requests r
            WHERE r.customer_id = $1 AND r.deleted_at IS NULL
            ORDER BY r.created_at DESC
        `, [customer_id]);

        res.json({ requests: result.rows });
    } catch (err) {
        console.error('Get my repair requests error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// CUSTOMER: GET REPAIR REQUEST DETAILS WITH BIDS
// ============================================

export async function getRepairRequestDetails(req: AuthRequest, res: Response) {
    try {
        const { request_id } = req.params;
        const user_id = req.user?.user_id;

        const requestResult = await readPool.query(`
            SELECT r.*, u.full_name as customer_name, u.phone_number as customer_phone
            FROM repair_requests r
            LEFT JOIN users u ON r.customer_id = u.user_id
            WHERE r.request_id = $1 AND r.deleted_at IS NULL
        `, [request_id]);

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requestResult.rows[0];

        // Get bids
        const bidsResult = await readPool.query(`
            SELECT 
                b.*,
                g.name as garage_name,
                g.rating as garage_rating,
                g.address as garage_address
            FROM repair_bids b
            LEFT JOIN garages g ON b.garage_id = g.garage_id
            WHERE b.request_id = $1
            ORDER BY b.estimated_cost ASC
        `, [request_id]);

        res.json({
            request,
            bids: bidsResult.rows
        });
    } catch (err) {
        console.error('Get repair request details error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// CUSTOMER: ACCEPT BID & CREATE BOOKING
// ============================================

export async function acceptRepairBid(req: AuthRequest, res: Response) {
    try {
        const customer_id = req.user?.user_id;
        const { bid_id } = req.params;
        const { scheduled_date, scheduled_time, customer_notes } = req.body;

        if (!customer_id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get bid and request details
        const bidResult = await readPool.query(`
            SELECT b.*, r.customer_id as request_customer_id, r.request_id
            FROM repair_bids b
            JOIN repair_requests r ON b.request_id = r.request_id
            WHERE b.bid_id = $1 AND b.status = 'pending'
        `, [bid_id]);

        if (bidResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found or already processed' });
        }

        const bid = bidResult.rows[0];

        // Verify customer owns the request
        if (bid.request_customer_id !== customer_id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Begin transaction
        const client = await writePool.connect();
        try {
            await client.query('BEGIN');

            // Update bid status
            await client.query(`
                UPDATE repair_bids SET status = 'accepted', accepted_at = now()
                WHERE bid_id = $1
            `, [bid_id]);

            // Reject other bids
            await client.query(`
                UPDATE repair_bids SET status = 'rejected', rejected_at = now()
                WHERE request_id = $1 AND bid_id != $2 AND status = 'pending'
            `, [bid.request_id, bid_id]);

            // Update request status
            await client.query(`
                UPDATE repair_requests SET status = 'booked', updated_at = now()
                WHERE request_id = $1
            `, [bid.request_id]);

            // Create booking
            const bookingResult = await client.query(`
                INSERT INTO repair_bookings (
                    request_id, bid_id, garage_id, customer_id,
                    scheduled_date, scheduled_time, estimated_duration,
                    customer_notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING booking_id
            `, [
                bid.request_id, bid_id, bid.garage_id, customer_id,
                scheduled_date, scheduled_time || null, bid.estimated_duration,
                customer_notes || null
            ]);

            await client.query('COMMIT');

            const booking = bookingResult.rows[0];

            // Notify workshop
            emitToGarage(bid.garage_id, 'repair_booking_new', {
                booking_id: booking.booking_id,
                scheduled_date
            });

            res.json({
                message: 'Booking confirmed',
                booking_id: booking.booking_id
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Accept repair bid error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// CUSTOMER: GET MY BOOKINGS
// ============================================

export async function getMyRepairBookings(req: AuthRequest, res: Response) {
    try {
        const customer_id = req.user?.user_id;
        if (!customer_id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await readPool.query(`
            SELECT 
                b.*,
                g.name as garage_name,
                g.address as garage_address,
                g.phone as garage_phone,
                r.car_make, r.car_model, r.problem_type, r.problem_description
            FROM repair_bookings b
            LEFT JOIN garages g ON b.garage_id = g.garage_id
            LEFT JOIN repair_requests r ON b.request_id = r.request_id
            WHERE b.customer_id = $1
            ORDER BY b.scheduled_date DESC
        `, [customer_id]);

        res.json({ bookings: result.rows });
    } catch (err) {
        console.error('Get my repair bookings error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// WORKSHOP: GET ACTIVE REPAIR REQUESTS
// ============================================

export async function getActiveRepairRequests(req: AuthRequest, res: Response) {
    try {
        const garage_id = req.user?.user_id; // For workshops, user_id IS the garage_id
        if (!garage_id) {
            return res.status(403).json({ error: 'Workshop access required' });
        }

        // Get active requests, excluding ones already bid on by this workshop
        const result = await readPool.query(`
            SELECT 
                r.*,
                u.full_name as customer_name,
                (SELECT COUNT(*) FROM repair_bids WHERE request_id = r.request_id) as bid_count,
                EXISTS(SELECT 1 FROM repair_bids WHERE request_id = r.request_id AND garage_id = $1) as already_bid
            FROM repair_requests r
            LEFT JOIN users u ON r.customer_id = u.user_id
            WHERE r.status = 'active' 
                AND r.expires_at > now()
                AND r.deleted_at IS NULL
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [garage_id]);

        res.json({ requests: result.rows });
    } catch (err) {
        console.error('Get active repair requests error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// WORKSHOP: SUBMIT BID
// ============================================

export async function submitRepairBid(req: AuthRequest, res: Response) {
    try {
        const garage_id = req.user?.user_id; // For workshops, user_id IS the garage_id
        if (!garage_id) {
            return res.status(403).json({ error: 'Workshop access required' });
        }

        const { request_id } = req.params;
        const {
            estimated_cost,
            labor_cost,
            parts_cost,
            diagnosis_fee,
            estimated_duration,
            notes,
            warranty_days,
            includes_parts,
            available_slots,
            earliest_date
        } = req.body;

        if (!estimated_cost) {
            return res.status(400).json({ error: 'Estimated cost required' });
        }

        // Check request exists and is active
        const requestCheck = await readPool.query(`
            SELECT request_id, customer_id, status FROM repair_requests 
            WHERE request_id = $1 AND status = 'active' AND expires_at > now()
        `, [request_id]);

        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or no longer active' });
        }

        // Check if already bid
        const existingBid = await readPool.query(`
            SELECT bid_id FROM repair_bids WHERE request_id = $1 AND garage_id = $2
        `, [request_id, garage_id]);

        if (existingBid.rows.length > 0) {
            return res.status(400).json({ error: 'You have already submitted a bid for this request' });
        }

        const result = await writePool.query(`
            INSERT INTO repair_bids (
                request_id, garage_id,
                estimated_cost, labor_cost, parts_cost, diagnosis_fee,
                estimated_duration, notes, warranty_days, includes_parts,
                available_slots, earliest_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING bid_id, created_at
        `, [
            request_id, garage_id,
            estimated_cost, labor_cost || null, parts_cost || null, diagnosis_fee || 0,
            estimated_duration || null, notes || null, warranty_days || 0, includes_parts || false,
            available_slots ? JSON.stringify(available_slots) : null, earliest_date || null
        ]);

        // Update bid count on request
        await writePool.query(`
            UPDATE repair_requests SET bid_count = bid_count + 1, status = 'bidding', updated_at = now()
            WHERE request_id = $1
        `, [request_id]);

        const bid = result.rows[0];

        // Notify customer
        const request = requestCheck.rows[0];
        emitToUser(request.customer_id, 'repair_bid_new', {
            request_id,
            bid_id: bid.bid_id,
            estimated_cost
        });

        res.status(201).json({
            message: 'Bid submitted successfully',
            bid_id: bid.bid_id
        });
    } catch (err) {
        console.error('Submit repair bid error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// WORKSHOP: GET MY BIDS
// ============================================

export async function getMyRepairBids(req: AuthRequest, res: Response) {
    try {
        const garage_id = req.user?.user_id; // For workshops, user_id IS the garage_id
        if (!garage_id) {
            return res.status(403).json({ error: 'Workshop access required' });
        }

        const result = await readPool.query(`
            SELECT 
                b.*,
                r.car_make, r.car_model, r.problem_type, r.problem_description,
                r.status as request_status
            FROM repair_bids b
            LEFT JOIN repair_requests r ON b.request_id = r.request_id
            WHERE b.garage_id = $1
            ORDER BY b.created_at DESC
        `, [garage_id]);

        res.json({ bids: result.rows });
    } catch (err) {
        console.error('Get my repair bids error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// WORKSHOP: GET MY BOOKINGS
// ============================================

export async function getWorkshopBookings(req: AuthRequest, res: Response) {
    try {
        const garage_id = req.user?.user_id; // For workshops, user_id IS the garage_id
        if (!garage_id) {
            return res.status(403).json({ error: 'Workshop access required' });
        }

        const { status, from_date, to_date } = req.query;

        let query = `
            SELECT 
                b.*,
                r.car_make, r.car_model, r.problem_type, r.problem_description,
                u.full_name as customer_name, u.phone_number as customer_phone
            FROM repair_bookings b
            LEFT JOIN repair_requests r ON b.request_id = r.request_id
            LEFT JOIN users u ON b.customer_id = u.user_id
            WHERE b.garage_id = $1
        `;
        const params: any[] = [garage_id];
        let paramIndex = 2;

        if (status) {
            query += ` AND b.status = $${paramIndex++}`;
            params.push(status);
        }
        if (from_date) {
            query += ` AND b.scheduled_date >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND b.scheduled_date <= $${paramIndex++}`;
            params.push(to_date);
        }

        query += ' ORDER BY b.scheduled_date ASC, b.scheduled_time ASC';

        const result = await readPool.query(query, params);

        res.json({ bookings: result.rows });
    } catch (err) {
        console.error('Get workshop bookings error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}

// ============================================
// WORKSHOP: UPDATE BOOKING STATUS
// ============================================

export async function updateBookingStatus(req: AuthRequest, res: Response) {
    try {
        const garage_id = req.user?.user_id; // For workshops, user_id IS the garage_id
        const { booking_id } = req.params;
        const { status, workshop_notes, final_cost, completion_notes } = req.body;

        if (!garage_id) {
            return res.status(403).json({ error: 'Workshop access required' });
        }

        const validStatuses = ['confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verify ownership
        const check = await readPool.query(`
            SELECT booking_id, customer_id FROM repair_bookings WHERE booking_id = $1 AND garage_id = $2
        `, [booking_id, garage_id]);

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = check.rows[0];

        // Build update query
        let updates = ['status = $1', 'updated_at = now()'];
        let params: any[] = [status];
        let paramIndex = 2;

        if (status === 'checked_in') {
            updates.push(`checked_in_at = now()`);
        } else if (status === 'in_progress') {
            updates.push(`work_started_at = now()`);
        } else if (status === 'completed') {
            updates.push(`completed_at = now()`);
            if (final_cost) {
                updates.push(`final_cost = $${paramIndex++}`);
                params.push(final_cost);
            }
            if (completion_notes) {
                updates.push(`completion_notes = $${paramIndex++}`);
                params.push(completion_notes);
            }
        } else if (status === 'cancelled') {
            updates.push(`cancelled_at = now()`);
        }

        if (workshop_notes) {
            updates.push(`workshop_notes = $${paramIndex++}`);
            params.push(workshop_notes);
        }

        params.push(booking_id);

        await writePool.query(`
            UPDATE repair_bookings SET ${updates.join(', ')}
            WHERE booking_id = $${paramIndex}
        `, params);

        // Notify customer
        emitToUser(booking.customer_id, 'repair_booking_update', {
            booking_id,
            status
        });

        res.json({ message: 'Booking updated', status });
    } catch (err) {
        console.error('Update booking status error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
}
