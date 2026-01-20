/**
 * Vehicle Service
 * Handles customer vehicle management and auto-save
 */
import { Pool } from 'pg';

export class VehicleService {
    constructor(private pool: Pool) { }

    async getMyVehicles(customerId: string) {
        const result = await this.pool.query(`SELECT vehicle_id, car_make, car_model, car_year, vin_number, front_image_url, rear_image_url, nickname, is_primary, last_used_at, request_count, created_at FROM customer_vehicles WHERE customer_id = $1 ORDER BY is_primary DESC, last_used_at DESC NULLS LAST LIMIT 10`, [customerId]);
        return result.rows;
    }

    async saveVehicle(customerId: string, data: { car_make: string; car_model: string; car_year: number; vin_number?: string; nickname?: string; front_image_url?: string; rear_image_url?: string; is_primary?: boolean }) {
        if (data.is_primary) { await this.pool.query(`UPDATE customer_vehicles SET is_primary = false, updated_at = NOW() WHERE customer_id = $1`, [customerId]); }
        if (data.vin_number) {
            const existing = await this.pool.query(`SELECT vehicle_id FROM customer_vehicles WHERE customer_id = $1 AND vin_number = $2`, [customerId, data.vin_number]);
            if (existing.rows.length > 0) {
                const updated = await this.pool.query(`UPDATE customer_vehicles SET car_make = $2, car_model = $3, car_year = $4, nickname = COALESCE($5, nickname), front_image_url = COALESCE($6, front_image_url), rear_image_url = COALESCE($7, rear_image_url), is_primary = COALESCE($8, is_primary), updated_at = NOW() WHERE vehicle_id = $9 RETURNING *`, [customerId, data.car_make, data.car_model, data.car_year, data.nickname, data.front_image_url, data.rear_image_url, data.is_primary, existing.rows[0].vehicle_id]);
                return { vehicle: updated.rows[0], updated: true };
            }
        }
        const result = await this.pool.query(`INSERT INTO customer_vehicles (customer_id, car_make, car_model, car_year, vin_number, nickname, front_image_url, rear_image_url, is_primary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [customerId, data.car_make, data.car_model, data.car_year, data.vin_number || null, data.nickname || null, data.front_image_url || null, data.rear_image_url || null, data.is_primary || false]);
        return { vehicle: result.rows[0], updated: false };
    }

    async updateVehicle(customerId: string, vehicleId: string, data: { nickname?: string; is_primary?: boolean; vin_number?: string }) {
        if (data.is_primary) { await this.pool.query(`UPDATE customer_vehicles SET is_primary = false, updated_at = NOW() WHERE customer_id = $1 AND vehicle_id != $2`, [customerId, vehicleId]); }
        const result = await this.pool.query(`UPDATE customer_vehicles SET nickname = COALESCE($3, nickname), is_primary = COALESCE($4, is_primary), vin_number = COALESCE($5, vin_number), updated_at = NOW() WHERE vehicle_id = $1 AND customer_id = $2 RETURNING *`, [vehicleId, customerId, data.nickname, data.is_primary, data.vin_number]);
        return result.rows[0] || null;
    }

    async deleteVehicle(customerId: string, vehicleId: string) {
        console.log('[DELETE-VEHICLE] Starting deletion check', { customerId, vehicleId });

        // Get vehicle details first
        const vehicleResult = await this.pool.query(
            `SELECT car_make, car_model, car_year FROM customer_vehicles WHERE vehicle_id = $1 AND customer_id = $2`,
            [vehicleId, customerId]
        );

        if (vehicleResult.rows.length === 0) {
            console.log('[DELETE-VEHICLE] Vehicle not found');
            throw new Error('Vehicle not found');
        }

        const vehicle = vehicleResult.rows[0];
        console.log('[DELETE-VEHICLE] Vehicle details:', vehicle);


        // Check for active part requests (still waiting for bids)
        // Note: 'accepted' requests have orders which are checked separately below
        const activeRequestsResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM part_requests 
             WHERE customer_id = $1 
             AND car_make = $2 AND car_model = $3 AND car_year = $4
             AND status = 'active'`,
            [customerId, vehicle.car_make, vehicle.car_model, vehicle.car_year]
        );

        const activeRequestsCount = parseInt(activeRequestsResult.rows[0].count);
        console.log('[DELETE-VEHICLE] Active requests count:', activeRequestsCount);

        // Check for active orders
        const activeOrdersResult = await this.pool.query(
            `SELECT COUNT(*) as count FROM orders o
             INNER JOIN part_requests pr ON o.request_id = pr.request_id
             WHERE pr.customer_id = $1
             AND pr.car_make = $2 AND pr.car_model = $3 AND pr.car_year = $4
             AND o.order_status NOT IN ('completed', 'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops')`,
            [customerId, vehicle.car_make, vehicle.car_model, vehicle.car_year]
        );

        const activeOrdersCount = parseInt(activeOrdersResult.rows[0].count);
        console.log('[DELETE-VEHICLE] Active orders count:', activeOrdersCount);


        // Block deletion if any active items exist
        // NOTE: quick_service_bookings check removed - table purged with Quick Services feature
        if (activeRequestsCount > 0 || activeOrdersCount > 0) {
            const errors = [];
            if (activeRequestsCount > 0) errors.push(`${activeRequestsCount} active request${activeRequestsCount > 1 ? 's' : ''}`);
            if (activeOrdersCount > 0) errors.push(`${activeOrdersCount} active order${activeOrdersCount > 1 ? 's' : ''}`);

            const errorMessage = `Cannot delete vehicle. This vehicle has ${errors.join(', ')}. Please complete or cancel them first.`;
            console.log('[DELETE-VEHICLE] BLOCKED:', errorMessage);
            throw new Error(errorMessage);
        }

        console.log('[DELETE-VEHICLE] All checks passed, proceeding with deletion');

        // Safe to delete
        const result = await this.pool.query(
            `DELETE FROM customer_vehicles WHERE vehicle_id = $1 AND customer_id = $2 RETURNING vehicle_id`,
            [vehicleId, customerId]
        );

        console.log('[DELETE-VEHICLE] Deletion successful');
        return result.rowCount! > 0;
    }

    async autoSaveVehicle(customerId: string, carMake: string, carModel: string, carYear: number, vinNumber?: string, frontImageUrl?: string, rearImageUrl?: string) {
        let existing;
        if (vinNumber) { existing = await this.pool.query(`SELECT vehicle_id FROM customer_vehicles WHERE customer_id = $1 AND vin_number = $2`, [customerId, vinNumber]); }
        else { existing = await this.pool.query(`SELECT vehicle_id FROM customer_vehicles WHERE customer_id = $1 AND car_make = $2 AND car_model = $3 AND car_year = $4 AND vin_number IS NULL`, [customerId, carMake, carModel, carYear]); }
        if (existing.rows.length > 0) {
            await this.pool.query(`UPDATE customer_vehicles SET last_used_at = NOW(), front_image_url = COALESCE($2, front_image_url), rear_image_url = COALESCE($3, rear_image_url), updated_at = NOW() WHERE vehicle_id = $1`, [existing.rows[0].vehicle_id, frontImageUrl, rearImageUrl]);
            return existing.rows[0].vehicle_id;
        }
        const result = await this.pool.query(`INSERT INTO customer_vehicles (customer_id, car_make, car_model, car_year, vin_number, front_image_url, rear_image_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING vehicle_id`, [customerId, carMake, carModel, carYear, vinNumber || null, frontImageUrl, rearImageUrl]);
        return result.rows[0].vehicle_id;
    }
}
