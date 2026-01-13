import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';

// ============================================
// GET MY VEHICLES
// ============================================
export const getMyVehicles = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user?.id;

        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const result = await pool.query(`
            SELECT 
                vehicle_id,
                car_make,
                car_model,
                car_year,
                vin_number,
                front_image_url,
                rear_image_url,
                nickname,
                is_primary,
                last_used_at,
                request_count,
                created_at
            FROM customer_vehicles
            WHERE customer_id = $1
            ORDER BY is_primary DESC, last_used_at DESC NULLS LAST
            LIMIT 10
        `, [customerId]);

        res.json({
            success: true,
            vehicles: result.rows
        });
    } catch (error) {
        console.error('[Vehicles] Error fetching vehicles:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ============================================
// SAVE NEW VEHICLE
// ============================================
export const saveVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user?.id;

        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const {
            car_make,
            car_model,
            car_year,
            vin_number,
            nickname,
            front_image_url,
            rear_image_url,
            is_primary
        } = req.body;

        // Validation
        if (!car_make || !car_model || !car_year) {
            return res.status(400).json({
                success: false,
                error: 'car_make, car_model, and car_year are required'
            });
        }

        // If setting as primary, unset other primaries first
        if (is_primary) {
            await pool.query(`
                UPDATE customer_vehicles 
                SET is_primary = false, updated_at = NOW()
                WHERE customer_id = $1
            `, [customerId]);
        }

        // Check if vehicle with same VIN already exists
        if (vin_number) {
            const existing = await pool.query(`
                SELECT vehicle_id FROM customer_vehicles 
                WHERE customer_id = $1 AND vin_number = $2
            `, [customerId, vin_number]);

            if (existing.rows.length > 0) {
                // Update existing vehicle
                const updated = await pool.query(`
                    UPDATE customer_vehicles SET
                        car_make = $2,
                        car_model = $3,
                        car_year = $4,
                        nickname = COALESCE($5, nickname),
                        front_image_url = COALESCE($6, front_image_url),
                        rear_image_url = COALESCE($7, rear_image_url),
                        is_primary = COALESCE($8, is_primary),
                        updated_at = NOW()
                    WHERE vehicle_id = $9
                    RETURNING *
                `, [
                    customerId,
                    car_make,
                    car_model,
                    car_year,
                    nickname,
                    front_image_url,
                    rear_image_url,
                    is_primary,
                    existing.rows[0].vehicle_id
                ]);

                return res.json({
                    success: true,
                    message: 'Vehicle updated',
                    vehicle: updated.rows[0]
                });
            }
        }

        // Insert new vehicle
        const result = await pool.query(`
            INSERT INTO customer_vehicles (
                customer_id, car_make, car_model, car_year, vin_number,
                nickname, front_image_url, rear_image_url, is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            customerId,
            car_make,
            car_model,
            car_year,
            vin_number || null,
            nickname || null,
            front_image_url || null,
            rear_image_url || null,
            is_primary || false
        ]);

        res.status(201).json({
            success: true,
            message: 'Vehicle saved',
            vehicle: result.rows[0]
        });
    } catch (error) {
        console.error('[Vehicles] Error saving vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ============================================
// UPDATE VEHICLE
// ============================================
export const updateVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user?.id;
        const { vehicleId } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const { nickname, is_primary } = req.body;

        // If setting as primary, unset other primaries first
        if (is_primary) {
            await pool.query(`
                UPDATE customer_vehicles 
                SET is_primary = false, updated_at = NOW()
                WHERE customer_id = $1 AND vehicle_id != $2
            `, [customerId, vehicleId]);
        }

        const result = await pool.query(`
            UPDATE customer_vehicles SET
                nickname = COALESCE($3, nickname),
                is_primary = COALESCE($4, is_primary),
                updated_at = NOW()
            WHERE vehicle_id = $1 AND customer_id = $2
            RETURNING *
        `, [vehicleId, customerId, nickname, is_primary]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        res.json({
            success: true,
            vehicle: result.rows[0]
        });
    } catch (error) {
        console.error('[Vehicles] Error updating vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ============================================
// DELETE VEHICLE
// ============================================
export const deleteVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const customerId = req.user?.id;
        const { vehicleId } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const result = await pool.query(`
            DELETE FROM customer_vehicles 
            WHERE vehicle_id = $1 AND customer_id = $2
            RETURNING vehicle_id
        `, [vehicleId, customerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        res.json({
            success: true,
            message: 'Vehicle deleted'
        });
    } catch (error) {
        console.error('[Vehicles] Error deleting vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ============================================
// AUTO-SAVE VEHICLE (called after request creation)
// ============================================
export const autoSaveVehicle = async (
    customerId: string,
    carMake: string,
    carModel: string,
    carYear: number,
    vinNumber?: string,
    frontImageUrl?: string,
    rearImageUrl?: string
): Promise<string | null> => {
    try {
        // Check if vehicle already exists (by VIN or make/model/year combo)
        let existing;

        if (vinNumber) {
            existing = await pool.query(`
                SELECT vehicle_id FROM customer_vehicles 
                WHERE customer_id = $1 AND vin_number = $2
            `, [customerId, vinNumber]);
        } else {
            existing = await pool.query(`
                SELECT vehicle_id FROM customer_vehicles 
                WHERE customer_id = $1 
                    AND car_make = $2 
                    AND car_model = $3 
                    AND car_year = $4
                    AND vin_number IS NULL
            `, [customerId, carMake, carModel, carYear]);
        }

        if (existing.rows.length > 0) {
            // Update last_used_at and images if provided
            await pool.query(`
                UPDATE customer_vehicles SET
                    last_used_at = NOW(),
                    front_image_url = COALESCE($2, front_image_url),
                    rear_image_url = COALESCE($3, rear_image_url),
                    updated_at = NOW()
                WHERE vehicle_id = $1
            `, [existing.rows[0].vehicle_id, frontImageUrl, rearImageUrl]);

            return existing.rows[0].vehicle_id;
        }

        // Auto-save new vehicle
        const result = await pool.query(`
            INSERT INTO customer_vehicles (
                customer_id, car_make, car_model, car_year, vin_number,
                front_image_url, rear_image_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING vehicle_id
        `, [customerId, carMake, carModel, carYear, vinNumber || null, frontImageUrl, rearImageUrl]);

        console.log(`[Vehicles] Auto-saved vehicle for customer ${customerId}: ${carMake} ${carModel} ${carYear}`);
        return result.rows[0].vehicle_id;
    } catch (error) {
        console.error('[Vehicles] Auto-save failed:', error);
        return null; // Non-blocking - don't fail request creation
    }
};
