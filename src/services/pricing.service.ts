/**
 * Pricing Service - Statistical Analysis & Fraud Detection
 * Provides price benchmarking and outlier detection for insurance claims
 */

import { getReadPool, getWritePool } from '../config/db';

const readPool = getReadPool();
const writePool = getWritePool();

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
    p25: number; // 25th percentile
    p75: number; // 75th percentile
    last_updated: Date;
}

interface OutlierDetection {
    is_outlier: boolean;
    deviation_percent: number;
    avg_market_price: number;
    outlier_severity: 'normal' | 'low' | 'medium' | 'high' | 'critical' | 'no_data';
}

interface PriceCheckResult {
    quoted_price: number;
    benchmark: PriceStatistics | null;
    is_outlier: boolean;
    deviation_percent: number;
    severity: string;
    recommendation: string;
    alert_level: 'green' | 'yellow' | 'orange' | 'red';
}

/**
 * Get price statistics for a specific part
 */
export async function getPriceStatistics(
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
        if (vehicleMake) params.push(vehicleMake);
        if (vehicleModel) params.push(vehicleModel);

        const result = await readPool.query(query, params);

        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error getting price statistics:', error);
        return null;
    }
}

/**
 * Check if a quoted price is an outlier
 */
export async function checkPriceOutlier(
    partName: string,
    vehicleMake: string,
    vehicleModel: string,
    quotedPrice: number
): Promise<OutlierDetection> {
    try {
        const result = await readPool.query(
            'SELECT * FROM detect_price_outlier($1, $2, $3, $4)',
            [partName, vehicleMake, vehicleModel, quotedPrice]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        return {
            is_outlier: false,
            deviation_percent: 0,
            avg_market_price: 0,
            outlier_severity: 'no_data'
        };
    } catch (error) {
        console.error('Error checking price outlier:', error);
        return {
            is_outlier: false,
            deviation_percent: 0,
            avg_market_price: 0,
            outlier_severity: 'no_data'
        };
    }
}

/**
 * Comprehensive price check with recommendations
 */
export async function performPriceCheck(
    partName: string,
    vehicleMake: string,
    vehicleModel: string,
    quotedPrice: number
): Promise<PriceCheckResult> {
    const benchmark = await getPriceStatistics(partName, vehicleMake, vehicleModel);
    const outlierCheck = await checkPriceOutlier(partName, vehicleMake, vehicleModel, quotedPrice);

    let alertLevel: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    let recommendation = 'Price is within normal market range';

    if (outlierCheck.outlier_severity === 'no_data') {
        alertLevel = 'yellow';
        recommendation = 'Insufficient market data. Manual verification recommended.';
    } else if (outlierCheck.outlier_severity === 'critical') {
        alertLevel = 'red';
        recommendation = 'CRITICAL: Price is >50% above market average. Investigate for fraud.';
    } else if (outlierCheck.outlier_severity === 'high') {
        alertLevel = 'red';
        recommendation = 'HIGH RISK: Price is 30-50% above average. Request justification.';
    } else if (outlierCheck.outlier_severity === 'medium') {
        alertLevel = 'orange';
        recommendation = 'MODERATE: Price is 15-30% above average. Review recommended.';
    } else if (outlierCheck.outlier_severity === 'low') {
        alertLevel = 'yellow';
        recommendation = 'SLIGHT: Price is 10-15% above average. May be acceptable.';
    }

    return {
        quoted_price: quotedPrice,
        benchmark,
        is_outlier: outlierCheck.is_outlier,
        deviation_percent: outlierCheck.deviation_percent,
        severity: outlierCheck.outlier_severity,
        recommendation,
        alert_level: alertLevel
    };
}

/**
 * Record a new price data point
 */
export async function recordPrice(
    partName: string,
    vehicleMake: string,
    vehicleModel: string,
    vehicleYear: number | null,
    price: number,
    source: 'quote' | 'invoice' | 'catalog' | 'claim',
    sourceId?: string,
    garageId?: string
): Promise<void> {
    try {
        await writePool.query(`
            INSERT INTO part_price_history (
                part_name, vehicle_make, vehicle_model, vehicle_year,
                price, source, source_id, garage_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [partName, vehicleMake, vehicleModel, vehicleYear, price, source, sourceId, garageId]);
    } catch (error) {
        console.error('Error recording price:', error);
        throw error;
    }
}

/**
 * Get price trend for a part (last 6 months)
 */
export async function getPriceTrend(
    partName: string,
    vehicleMake?: string,
    vehicleModel?: string
): Promise<Array<{ month: string; avg_price: number; sample_size: number }>> {
    try {
        const query = `
            SELECT 
                TO_CHAR(recorded_at, 'YYYY-MM') as month,
                AVG(price) as avg_price,
                COUNT(*) as sample_size
            FROM part_price_history
            WHERE 
                part_name ILIKE $1
                ${vehicleMake ? 'AND vehicle_make ILIKE $2' : ''}
                ${vehicleModel ? 'AND vehicle_model ILIKE $3' : ''}
                AND recorded_at > NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(recorded_at, 'YYYY-MM')
            ORDER BY month DESC
        `;

        const params: any[] = [partName];
        if (vehicleMake) params.push(vehicleMake);
        if (vehicleModel) params.push(vehicleModel);

        const result = await readPool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting price trend:', error);
        return [];
    }
}

/**
 * Refresh price benchmarks (run daily via cron)
 */
export async function refreshBenchmarks(): Promise<void> {
    try {
        await writePool.query('SELECT refresh_price_benchmarks()');
        console.log('Price benchmarks refreshed successfully');
    } catch (error) {
        console.error('Error refreshing benchmarks:', error);
        throw error;
    }
}

/**
 * Get top inflated parts by garage (fraud detection)
 */
export async function getTopInflatedParts(
    garageId?: string,
    limit: number = 10
): Promise<Array<{
    part_name: string;
    garage_id: string;
    garage_name: string;
    avg_quoted_price: number;
    market_avg_price: number;
    inflation_percent: number;
    sample_size: number;
}>> {
    try {
        const query = `
            WITH garage_prices AS (
                SELECT 
                    pph.part_name,
                    pph.vehicle_make,
                    pph.vehicle_model,
                    pph.garage_id,
                    u.full_name as garage_name,
                    AVG(pph.price) as avg_quoted_price,
                    COUNT(*) as sample_size
                FROM part_price_history pph
                LEFT JOIN users u ON pph.garage_id = u.user_id
                WHERE pph.garage_id IS NOT NULL
                    ${garageId ? 'AND pph.garage_id = $1' : ''}
                    AND pph.recorded_at > NOW() - INTERVAL '90 days'
                GROUP BY pph.part_name, pph.vehicle_make, pph.vehicle_model, pph.garage_id, u.full_name
                HAVING COUNT(*) >= 2
            )
            SELECT 
                gp.part_name,
                gp.garage_id,
                gp.garage_name,
                gp.avg_quoted_price,
                pb.avg_price as market_avg_price,
                ((gp.avg_quoted_price - pb.avg_price) / pb.avg_price * 100) as inflation_percent,
                gp.sample_size
            FROM garage_prices gp
            INNER JOIN part_price_benchmarks pb ON 
                gp.part_name = pb.part_name 
                AND gp.vehicle_make = pb.vehicle_make
                AND gp.vehicle_model = pb.vehicle_model
            WHERE ((gp.avg_quoted_price - pb.avg_price) / pb.avg_price * 100) > 15
            ORDER BY inflation_percent DESC
            LIMIT $${garageId ? '2' : '1'}
        `;

        const params = garageId ? [garageId, limit] : [limit];
        const result = await readPool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting top inflated parts:', error);
        return [];
    }
}

// ============================================
// BACKWARD COMPATIBILITY
// Legacy export for bid.controller.ts
// ============================================

/**
 * Get fair price estimate for a part (legacy method for bid controller)
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
        // Return default estimate when no data available
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

// Export as object for backward compatibility with bid.controller.ts
export const pricingService = {
    getFairPriceEstimate,
    getPriceStatistics,
    checkPriceOutlier,
    performPriceCheck,
    recordPrice,
    getPriceTrend,
    refreshBenchmarks,
    getTopInflatedParts
};
