
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function fixCoordinates() {
    const client = await pool.connect();
    try {
        console.log('🔍 Checking for broken assignments (NULL coordinates)...');

        // Find assignments with missing pickup/delivery coordinates
        const res = await client.query(`
            SELECT da.assignment_id, da.order_id, 
                   da.pickup_lat, da.pickup_lng, 
                   da.delivery_lat, da.delivery_lng
            FROM delivery_assignments da
            WHERE da.pickup_lat IS NULL 
               OR da.pickup_lng IS NULL 
               OR da.delivery_lat IS NULL 
               OR da.delivery_lng IS NULL
        `);

        console.log(`Found ${res.rowCount} assignments with missing coordinates.`);

        for (const row of res.rows) {
            console.log(`\n🔧 Fixing assignment ${row.assignment_id} (Order ${row.order_id})...`);

            // Fetch source coordinates from Garages and PartRequests
            const sourceData = await client.query(`
                SELECT 
                    g.location_lat as garage_lat, 
                    g.location_lng as garage_lng,
                    pr.delivery_lat as customer_lat, 
                    pr.delivery_lng as customer_lng
                FROM orders o
                JOIN garages g ON o.garage_id = g.garage_id
                JOIN part_requests pr ON o.request_id = pr.request_id
                WHERE o.order_id = $1
            `, [row.order_id]);

            if (sourceData.rowCount === 0) {
                console.log(`❌ Could not find source data for Order ${row.order_id}`);
                continue;
            }

            const src = sourceData.rows[0];

            // Update with source data
            await client.query(`
                UPDATE delivery_assignments
                SET 
                    pickup_lat = $1,
                    pickup_lng = $2,
                    delivery_lat = $3,
                    delivery_lng = $4
                WHERE assignment_id = $5
            `, [
                src.garage_lat,
                src.garage_lng,
                src.customer_lat,
                src.customer_lng,
                row.assignment_id
            ]);

            console.log(`✅ Fixed!`);
            console.log(`   Pickup: ${src.garage_lat}, ${src.garage_lng}`);
            console.log(`   Delivery: ${src.customer_lat}, ${src.customer_lng}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixCoordinates();
