
import { Pool, PoolClient } from 'pg';
import { getWritePool } from '../config/db';

export class DriverRepository {
    private pool: Pool;

    constructor() {
        this.pool = getWritePool();
    }

    private getClient(client?: PoolClient): Pool | PoolClient {
        return client || this.pool;
    }

    async findDriverByUserId(userId: string) {
        const result = await this.pool.query(
            'SELECT driver_id, status FROM drivers WHERE user_id = $1',
            [userId]
        );
        return result.rows[0];
    }

    async getDriverProfile(userId: string) {
        const result = await this.pool.query(`
            SELECT 
                d.driver_id, d.full_name, d.phone, d.email,
                d.vehicle_type, d.vehicle_plate, d.vehicle_model,
                d.status, d.total_deliveries, d.rating_average, d.rating_count,
                d.current_lat, d.current_lng, d.last_location_update,
                d.is_active, d.created_at,
                u.phone_number as login_phone
            FROM drivers d 
            JOIN users u ON d.user_id = u.user_id 
            WHERE d.user_id = $1
        `, [userId]);
        return result.rows[0];
    }

    async findActiveAssignments(userId: string, statusFilter: string) {
        const result = await this.pool.query(`
            SELECT 
                da.assignment_id, da.order_id, da.status, da.status as assignment_status,
                da.pickup_address, da.delivery_address,
                da.pickup_lat, da.pickup_lng, da.delivery_lat, da.delivery_lng,
                da.current_lat, da.current_lng,
                da.estimated_delivery, da.pickup_at, da.delivered_at,
                da.delivery_photo_url, da.driver_notes as delivery_notes,
                da.created_at as assigned_at,
                o.order_number, o.order_status, o.total_amount,
                pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                u.full_name as customer_name, u.phone_number as customer_phone,
                g.garage_name, g.address as garage_address,
                gu.phone_number as garage_phone
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON gu.user_id = g.garage_id AND gu.user_type = 'garage'
            WHERE d.user_id = $1 AND ${statusFilter}
            ORDER BY 
                CASE da.status 
                    WHEN 'in_transit' THEN 1 
                    WHEN 'picked_up' THEN 2 
                    WHEN 'assigned' THEN 3 
                    ELSE 4 
                END,
                da.created_at DESC
            LIMIT 50
        `, [userId]);
        return result.rows;
    }

    async findAssignmentById(assignmentId: string, userId: string, client?: PoolClient) {
        const db = this.getClient(client);
        const result = await db.query(`
            SELECT 
                da.*, d.driver_id,
                o.order_number, o.order_status, o.total_amount, o.created_at as order_created,
                o.customer_id, o.garage_id,
                pr.part_description, pr.car_make, pr.car_model, pr.car_year,
                pr.condition_required,
                u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email,
                g.garage_name, g.address as garage_address,
                gu.phone_number as garage_phone
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            JOIN part_requests pr ON o.request_id = pr.request_id
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            LEFT JOIN users gu ON gu.user_id = g.garage_id AND gu.user_type = 'garage'
            WHERE da.assignment_id = $1 AND d.user_id = $2
        `, [assignmentId, userId]);
        return result.rows[0];
    }

    async findAssignmentForUpdate(assignmentId: string, userId: string, client: PoolClient) {
        const result = await client.query(`
            SELECT da.*, d.driver_id, o.customer_id, o.garage_id, o.order_number, o.order_status
            FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            JOIN orders o ON da.order_id = o.order_id
            WHERE da.assignment_id = $1 AND d.user_id = $2
            FOR UPDATE
        `, [assignmentId, userId]);
        return result.rows[0];
    }

    async updateDriverLocation(driverId: string, lat: number, lng: number, heading = 0, speed = 0, accuracy = 0) {
        // 1. Update Profile (drivers table) - Legacy/Slow changing
        await this.pool.query(`
            UPDATE drivers SET 
                current_lat = $1, 
                current_lng = $2, 
                last_location_update = NOW(),
                updated_at = NOW()
            WHERE driver_id = $3
        `, [lat, lng, driverId]);

        // 2. Update Real-Time Tracking (driver_locations table) - High velocity
        await this.pool.query(`
            INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (driver_id) DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                heading = EXCLUDED.heading,
                speed = EXCLUDED.speed,
                updated_at = NOW()
        `, [driverId, lat, lng, heading || 0, speed || 0]);
    }

    async updateAssignmentsLocation(driverId: string, lat: number, lng: number) {
        const result = await this.pool.query(`
            WITH updated_assignments AS (
                UPDATE delivery_assignments SET
                    current_lat = $1,
                    current_lng = $2,
                    last_location_update = NOW(),
                    updated_at = NOW()
                WHERE driver_id = $3
                AND status IN ('assigned', 'picked_up', 'in_transit')
                RETURNING assignment_id, order_id
            )
            SELECT 
                ua.assignment_id, 
                ua.order_id,
                o.order_number,
                o.customer_id
            FROM updated_assignments ua
            JOIN orders o ON ua.order_id = o.order_id
        `, [lat, lng, driverId]);
        return result.rows;
    }

    async updateAssignmentStatus(
        assignmentId: string,
        status: string,
        notes: string | undefined,
        failureReason: string | undefined,
        client: PoolClient
    ) {
        let updateQuery = `
            UPDATE delivery_assignments SET
                status = $1,
                driver_notes = COALESCE($2, driver_notes),
                updated_at = NOW()
        `;
        const params: any[] = [status, notes];
        let paramIndex = 3;

        if (status === 'picked_up') {
            updateQuery += `, pickup_at = NOW()`;
        } else if (status === 'delivered') {
            updateQuery += `, delivered_at = NOW()`;
        } else if (status === 'failed') {
            updateQuery += `, failure_reason = $${paramIndex}`;
            params.push(failureReason || 'Unknown reason');
            paramIndex++;
        }

        updateQuery += ` WHERE assignment_id = $${paramIndex} RETURNING *`;
        params.push(assignmentId);

        const result = await client.query(updateQuery, params);
        return result.rows[0];
    }

    async updateOrderStatus(orderId: string, status: string, client: PoolClient) {
        await client.query(`
            UPDATE orders SET 
                order_status = $1, 
                updated_at = NOW()
            WHERE order_id = $2
        `, [status, orderId]);
    }

    async createStatusHistory(
        orderId: string,
        oldStatus: string,
        newStatus: string,
        userId: string,
        reason: string,
        client: PoolClient
    ) {
        await client.query(`
            INSERT INTO order_status_history 
            (order_id, old_status, new_status, changed_by_type, changed_by, reason)
            VALUES ($1, $2, $3, 'driver', $4, $5)
        `, [orderId, oldStatus, newStatus, userId, reason]);
    }

    async createDispute(
        orderId: string,
        customerId: string,
        garageId: string,
        reason: string,
        description: string,
        client: PoolClient
    ) {
        await client.query(`
            INSERT INTO disputes 
            (order_id, customer_id, garage_id, reason, description, photo_urls, refund_amount, restocking_fee, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        `, [orderId, customerId, garageId, reason, description, JSON.stringify([]), 0, 0]);
    }

    async countOtherActiveAssignments(driverId: string, currentAssignmentId: string, client: PoolClient) {
        const result = await client.query(`
            SELECT COUNT(*) FROM delivery_assignments 
            WHERE driver_id = $1 AND status IN ('assigned', 'picked_up', 'in_transit')
            AND assignment_id != $2
        `, [driverId, currentAssignmentId]);
        return parseInt(result.rows[0].count);
    }

    async updateDriverStatus(driverId: string, status: string, client?: PoolClient) {
        const db = this.getClient(client);
        await db.query(
            `UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2`,
            [status, driverId]
        );
    }

    async updateDriverStatusByUserId(userId: string, status: string) {
        const result = await this.pool.query(`
            UPDATE drivers SET 
                status = $1,
                updated_at = NOW()
            WHERE user_id = $2
            RETURNING driver_id, status
        `, [status, userId]);
        return result.rows[0];
    }

    async incrementDeliveryCount(driverId: string, client: PoolClient) {
        await client.query(`
            UPDATE drivers SET 
                total_deliveries = total_deliveries + 1,
                updated_at = NOW()
            WHERE driver_id = $1
        `, [driverId]);
    }

    async getOrderTotal(orderId: string, client: PoolClient) {
        const result = await client.query(
            'SELECT total_amount, order_number FROM orders WHERE order_id = $1',
            [orderId]
        );
        return result.rows[0];
    }

    async createPayout(
        driverId: string,
        assignmentId: string,
        orderId: string,
        orderNumber: string,
        amount: number,
        client: PoolClient
    ) {
        await client.query(`
            INSERT INTO driver_payouts 
                (driver_id, assignment_id, order_id, order_number, amount, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [driverId, assignmentId, orderId, orderNumber, amount.toFixed(2)]);
    }

    async updateDriverEarnings(driverId: string, amount: number, client: PoolClient) {
        await client.query(`
            UPDATE drivers SET 
                total_earnings = COALESCE(total_earnings, 0) + $1,
                updated_at = NOW()
            WHERE driver_id = $2
        `, [amount.toFixed(2), driverId]);
    }

    async saveDeliveryProof(
        assignmentId: string,
        photoUrl: string,
        signatureUrl: string | null,
        notes: string | undefined
    ) {
        const result = await this.pool.query(`
            UPDATE delivery_assignments SET
                delivery_photo_url = $1,
                signature_url = $2,
                driver_notes = COALESCE($3, driver_notes),
                updated_at = NOW()
            WHERE assignment_id = $4
            RETURNING *
        `, [photoUrl, signatureUrl, notes, assignmentId]);
        return result.rows[0];
    }

    async getDriverStats(userId: string) {
        const result = await this.pool.query(`
            SELECT 
                d.total_deliveries,
                d.rating_average,
                d.rating_count,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND DATE(da.delivered_at) = CURRENT_DATE) as today_deliveries,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND da.delivered_at >= CURRENT_DATE - INTERVAL '7 days') as week_deliveries,
                COUNT(*) FILTER (WHERE da.status IN ('assigned', 'picked_up', 'in_transit')) as active_assignments
            FROM drivers d
            LEFT JOIN delivery_assignments da ON d.driver_id = da.driver_id
            WHERE d.user_id = $1
            GROUP BY d.driver_id, d.total_deliveries, d.rating_average, d.rating_count
        `, [userId]);
        return result.rows[0];
    }

    async countActiveAssignmentsForUser(userId: string) {
        const result = await this.pool.query(`
            SELECT COUNT(*) FROM delivery_assignments da
            JOIN drivers d ON da.driver_id = d.driver_id
            WHERE d.user_id = $1 AND da.status IN ('assigned', 'picked_up', 'in_transit')
        `, [userId]);
        return parseInt(result.rows[0].count);
    }
}

export const driverRepository = new DriverRepository();
