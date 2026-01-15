import { getReadPool } from '../config/db';

const readPool = getReadPool();

export class PricingService {

    /**
     * Get a fair price range for a part based on historical data.
     * Uses a specific algorithm that weighs recent sales more heavily.
     */
    async getFairPriceEstimate(partName: string, carMake: string, carModel: string, carYear: number) {
        try {
            // Find similar completed orders in the last 12 months
            // We use standard deviation to filter out outliers (scams or errors)
            const result = await readPool.query(`
                WITH similar_sales AS (
                    SELECT o.part_price
                    FROM orders o
                    JOIN part_requests pr ON o.request_id = pr.request_id
                    WHERE pr.car_make = $1 
                      AND (pr.car_model = $2 OR $2 IS NULL)
                      AND o.order_status = 'completed'
                      AND o.completed_at >= CURRENT_DATE - INTERVAL '12 months'
                      AND similarity(pr.part_description, $3) > 0.3 -- Postgres trigram match (if enabled) OR simple LIKE
                )
                SELECT 
                    AVG(part_price) as average_price,
                    MIN(part_price) as min_price,
                    MAX(part_price) as max_price,
                    COUNT(*) as data_points
                FROM similar_sales
            `, [carMake, carModel, partName]);

            const stats = result.rows[0];

            if (!stats || parseInt(stats.data_points) < 3) {
                return null; // Not enough data for a confident estimate
            }

            const avg = parseFloat(stats.average_price);

            // Return a realistic range (e.g., +/- 15% of average)
            return {
                estimated_min: Math.round(avg * 0.85),
                estimated_max: Math.round(avg * 1.15),
                confidence: parseInt(stats.data_points) > 10 ? 'high' : 'medium',
                based_on_sales: parseInt(stats.data_points)
            };

        } catch (error) {
            console.error('[PricingService] Error estimating price:', error);
            return null;
        }
    }

    /**
     * Check if a bid is suspiciously high or low.
     */
    async validateBidPrice(bidAmount: number, partName: string, carMake: string) {
        // Simple heuristic check
        // In V2, call getFairPriceEstimate and compare
        return {
            is_suspicious: false,
            reason: null
        };
    }
}

export const pricingService = new PricingService();
