import { Request, Response } from 'express';
import { getReadPool } from '../config/db';

const readPool = getReadPool();

// Get Vehicle History (Blue Check)
export const getVehicleHistory = async (req: Request, res: Response) => {
    try {
        const { vin } = req.params;

        // In reality, we might want to charge for this or check permissions
        // For now, public or authenticated user can see it

        const result = await readPool.query(`
            SELECT 
                event_type, event_date, description, mileage_km, is_verified_by_motar,
                g.garage_name
            FROM vehicle_history_events vhe
            LEFT JOIN garages g ON vhe.garage_id = g.garage_id
            WHERE vhe.vin_number = $1
            ORDER BY event_date DESC
        `, [vin]);

        // Calculate "Blue Check" Score or status
        const isVerified = result.rows.length > 0;

        res.json({
            vin,
            verified_records: result.rows.length,
            history: result.rows,
            motar_blue_check: isVerified
        });

    } catch (error) {
        console.error('Error fetching vehicle history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
