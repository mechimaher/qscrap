// Check order status
const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'qscrap_db'
});

async function check() {
    try {
        const r = await pool.query(`
            SELECT order_id, order_status, customer_id, driver_id 
            FROM orders 
            ORDER BY updated_at DESC 
            LIMIT 5
        `);
        console.log('Recent orders:');
        console.log(JSON.stringify(r.rows, null, 2));
    } catch (e) {
        console.error(e.message);
    }
    await pool.end();
}
check();
