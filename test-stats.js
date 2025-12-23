const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres:password@localhost:5432/qscrap_db"
});

async function runTest() {
    try {
        const userIdRes = await pool.query("SELECT user_id FROM users WHERE user_type = 'driver' LIMIT 1");
        if (userIdRes.rows.length === 0) throw new Error('No drivers found');
        const userId = userIdRes.rows[0].user_id;

        console.log(`Testing stats for user: ${userId}`);

        const statsResult = await pool.query(`
            SELECT 
                d.total_deliveries,
                COUNT(*) FILTER (WHERE da.status = 'delivered' AND da.delivered_at >= CURRENT_DATE) as today_deliveries
            FROM drivers d
            LEFT JOIN delivery_assignments da ON d.driver_id = da.driver_id
            WHERE d.user_id = $1
            GROUP BY d.driver_id, d.total_deliveries
        `, [userId]);

        const row = statsResult.rows[0];
        console.log('Result Row:', row);
        console.log('Type of total_deliveries:', typeof row.total_deliveries);
        console.log('Value of total_deliveries:', row.total_deliveries);
        console.log('Type of today_deliveries:', typeof row.today_deliveries);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

runTest();
