/**
 * RepairService - Repair Booking Management
 */
import { Pool } from 'pg';

export class RepairService {
    constructor(private pool: Pool) { }

    async createRepairRequest(customerId: string, data: any) {
        const result = await this.pool.query(`
            INSERT INTO repair_requests (customer_id, car_id, service_type, issue_description, preferred_date, status)
            VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *
        `, [customerId, data.car_id, data.service_type, data.issue_description, data.preferred_date]);
        return result.rows[0];
    }

    async getMyRepairRequests(customerId: string, status?: string) {
        let query = `SELECT * FROM repair_requests WHERE customer_id = $1`;
        const params: any[] = [customerId];
        if (status) { query += ' AND status = $2'; params.push(status); }
        const result = await this.pool.query(query + ' ORDER BY created_at DESC', params);
        return result.rows;
    }

    async getRepairRequestDetails(requestId: string) {
        const result = await this.pool.query(`
            SELECT rr.*, COALESCE(json_agg(rb.*) FILTER (WHERE rb.bid_id IS NOT NULL), '[]') as bids
            FROM repair_requests rr
            LEFT JOIN repair_bids rb ON rr.request_id = rb.request_id
            WHERE rr.request_id = $1 GROUP BY rr.request_id
        `, [requestId]);
        return result.rows[0];
    }

    async acceptRepairBid(customerId: string, bidId: string, bookingDate: string) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const bid = await client.query('SELECT * FROM repair_bids WHERE bid_id = $1', [bidId]);
            if (!bid.rows[0]) throw new Error('Bid not found');

            const booking = await client.query(`
                INSERT INTO repair_bookings (request_id, garage_id, customer_id, bid_id, booking_date, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'confirmed') RETURNING *
            `, [bid.rows[0].request_id, bid.rows[0].garage_id, customerId, bidId, bookingDate, bid.rows[0].price]);

            await client.query('UPDATE repair_bids SET status = $1 WHERE bid_id = $2', ['accepted', bidId]);
            await client.query('UPDATE repair_requests SET status = $1 WHERE request_id = $2', ['booked', bid.rows[0].request_id]);
            await client.query('COMMIT');
            return booking.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getMyRepairBookings(customerId: string) {
        const result = await this.pool.query(`
            SELECT rb.*, g.garage_name FROM repair_bookings rb
            JOIN garages g ON rb.garage_id = g.garage_id
            WHERE rb.customer_id = $1 ORDER BY rb.created_at DESC
        `, [customerId]);
        return result.rows;
    }

    async getActiveRepairRequests(garageId: string) {
        const result = await this.pool.query(`
            SELECT rr.* FROM repair_requests rr
            WHERE rr.status = 'active' ORDER BY rr.created_at DESC
        `);
        return result.rows;
    }

    async submitRepairBid(garageId: string, requestId: string, price: number, notes: string) {
        const result = await this.pool.query(`
            INSERT INTO repair_bids (request_id, garage_id, price, notes, status)
            VALUES ($1, $2, $3, $4, 'pending') RETURNING *
        `, [requestId, garageId, price, notes]);
        return result.rows[0];
    }

    async getMyRepairBids(garageId: string) {
        const result = await this.pool.query(`
            SELECT rb.*, rr.issue_description FROM repair_bids rb
            JOIN repair_requests rr ON rb.request_id = rr.request_id
            WHERE rb.garage_id = $1 ORDER BY rb.created_at DESC
        `, [garageId]);
        return result.rows;
    }

    async getWorkshopBookings(garageId: string) {
        const result = await this.pool.query(`
            SELECT rb.* FROM repair_bookings rb
            WHERE rb.garage_id = $1 ORDER BY rb.booking_date DESC
        `, [garageId]);
        return result.rows;
    }

    async updateBookingStatus(garageId: string, bookingId: string, status: string, notes?: string) {
        const result = await this.pool.query(`
            UPDATE repair_bookings SET status = $1, notes = $2, updated_at = NOW()
            WHERE booking_id = $3 AND garage_id = $4 RETURNING *
        `, [status, notes, bookingId, garageId]);
        return result.rows[0];
    }
}
