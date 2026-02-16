/**
 * Pricing Service - Fair Price Estimation
 * Provides price benchmarking for the bid controller
 */

import { getReadPool } from '../config/db';
import logger from '../utils/logger';

const readPool = getReadPool();

interface PriceStatistics {
    part_name: string;
    vehicle_make: string;
    vehicle_model: string;
    sample_size: number;
    avg_price: number;
    min_price: number;
    max_price: number;
    median_price: number;
    std_dev: number;
    p25: number;
    p75: number;
    last_updated: Date;
}

/**
 * Get price statistics for a specific part
 */
async function getPriceStatistics(
    partName: string,
    vehicleMake?: string,
    vehicleModel?: string
): Promise<PriceStatistics | null> {
    try {
        const query = `
            SELECT * FROM part_price_benchmarks
            WHERE 
                part_name ILIKE $1
                ${vehicleMake ? 'AND vehicle_make ILIKE $2' : ''}
                ${vehicleModel ? 'AND vehicle_model ILIKE $3' : ''}
            LIMIT 1
        `;

        const params: any[] = [partName];
        if (vehicleMake) {params.push(vehicleMake);}
        if (vehicleModel) {params.push(vehicleModel);}

        const result = await readPool.query(query, params);

        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        logger.error('Error getting price statistics', { error: (error as Error).message });
        return null;
    }
}

/**
 * Get fair price estimate for a part (used by bid.controller.ts)
 */
async function getFairPriceEstimate(
    partName: string,
    carMake: string,
    carModel: string,
    carYear: number
): Promise<{
    estimated_price: number;
    price_range: { min: number; max: number };
    confidence: string;
    data_points: number;
}> {
    const stats = await getPriceStatistics(partName, carMake, carModel);

    if (!stats || stats.sample_size < 3) {
        return {
            estimated_price: 0,
            price_range: { min: 0, max: 0 },
            confidence: 'low',
            data_points: 0
        };
    }

    return {
        estimated_price: stats.avg_price,
        price_range: { min: stats.min_price, max: stats.max_price },
        confidence: stats.sample_size >= 10 ? 'high' : stats.sample_size >= 5 ? 'medium' : 'low',
        data_points: stats.sample_size
    };
}

export const pricingService = {
    getFairPriceEstimate
};
