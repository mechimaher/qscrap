// Location-Aware Garage Recommendations Service
import pool from '../config/db';

interface GarageRecommendation {
    garage_id: string;
    garage_name: string;
    distance_km: number;
    rating_average: number;
    total_transactions: number;
    response_time_avg: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function getLocationAwareRecommendations(
    customerLat: number,
    customerLon: number,
    maxDistance: number = 50 // km
): Promise<GarageRecommendation[]> {
    // Get all active garages with their locations
    const result = await pool.query(
        `SELECT 
            g.garage_id,
            g.garage_name,
            g.latitude,
            g.longitude,
            g.rating_average,
            g.total_transactions,
            COALESCE(AVG(EXTRACT(EPOCH FROM (co.responded_at - co.created_at))/60), 60) as response_time_avg
         FROM garages g
         LEFT JOIN counter_offers co ON g.garage_id = co.offered_by_id AND co.offered_by_type = 'garage'
         WHERE g.status = 'active'
           AND g.latitude IS NOT NULL
           AND g.longitude IS NOT NULL
         GROUP BY g.garage_id
         HAVING g.rating_average >= 3.5 OR g.rating_average IS NULL
         ORDER BY g.rating_average DESC NULLS LAST`
    );

    const recommendations: GarageRecommendation[] = [];

    for (const garage of result.rows) {
        const distance = calculateDistance(
            customerLat,
            customerLon,
            parseFloat(garage.latitude),
            parseFloat(garage.longitude)
        );

        if (distance <= maxDistance) {
            recommendations.push({
                garage_id: garage.garage_id,
                garage_name: garage.garage_name,
                distance_km: Math.round(distance * 10) / 10,
                rating_average: garage.rating_average || 0,
                total_transactions: garage.total_transactions || 0,
                response_time_avg: Math.round(garage.response_time_avg),
            });
        }
    }

    // Sort by composite score: distance (40%), rating (30%), transactions (20%), response time (10%)
    recommendations.sort((a, b) => {
        const scoreA =
            (1 - Math.min(a.distance_km / maxDistance, 1)) * 0.4 +
            (a.rating_average / 5) * 0.3 +
            Math.min(a.total_transactions / 100, 1) * 0.2 +
            (1 - Math.min(a.response_time_avg / 120, 1)) * 0.1;

        const scoreB =
            (1 - Math.min(b.distance_km / maxDistance, 1)) * 0.4 +
            (b.rating_average / 5) * 0.3 +
            Math.min(b.total_transactions / 100, 1) * 0.2 +
            (1 - Math.min(b.response_time_avg / 120, 1)) * 0.1;

        return scoreB - scoreA;
    });

    return recommendations.slice(0, 10); // Top 10 recommendations
}

export default { getLocationAwareRecommendations };
