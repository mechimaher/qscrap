const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'qscrap_db'
});

async function getCredentials() {
    try {
        // Get drivers
        const drivers = await pool.query(`
            SELECT u.phone_number, u.full_name, d.driver_id 
            FROM users u 
            JOIN drivers d ON u.user_id = d.user_id 
            WHERE u.user_type = 'driver' 
            LIMIT 5
        `);

        console.log('\n=== DRIVER CREDENTIALS ===');
        if (drivers.rows.length === 0) {
            console.log('No drivers found in database');
        } else {
            drivers.rows.forEach(row => {
                console.log(`Phone: ${row.phone_number} | Name: ${row.full_name}`);
            });
        }
        console.log('Password: Test@1234 (default for all test users)\n');

        // Get other user types too
        const customers = await pool.query(`
            SELECT phone_number, full_name FROM users WHERE user_type = 'customer' LIMIT 3
        `);
        console.log('=== CUSTOMER CREDENTIALS ===');
        customers.rows.forEach(row => {
            console.log(`Phone: ${row.phone_number} | Name: ${row.full_name}`);
        });

        const garages = await pool.query(`
            SELECT u.phone_number, g.garage_name FROM users u 
            JOIN garages g ON u.user_id = g.garage_id 
            WHERE u.user_type = 'garage' LIMIT 3
        `);
        console.log('\n=== GARAGE CREDENTIALS ===');
        garages.rows.forEach(row => {
            console.log(`Phone: ${row.phone_number} | Garage: ${row.garage_name}`);
        });

        const ops = await pool.query(`
            SELECT phone_number, full_name FROM users WHERE user_type IN ('operations', 'admin') LIMIT 3
        `);
        console.log('\n=== OPERATIONS CREDENTIALS ===');
        ops.rows.forEach(row => {
            console.log(`Phone: ${row.phone_number} | Name: ${row.full_name}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

getCredentials();
