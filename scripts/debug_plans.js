
const { Pool } = require('pg');

const pool = new Pool({
    user: 'qscrap',
    host: 'postgres', // docker-compose service name, might need 'localhost' if running outside container but this environment seems to be outside.
    database: 'qscrap',
    password: 'password', // Default or from env? 
    port: 5432,
});

// Try connecting to localhost first as we are likely in the dev environment shell
const localPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'qscrap_db',
    password: 'password',
    port: 5432,
});


async function checkPlans() {
    try {
        console.log('Connecting to DB...');
        // Try local
        const client = await localPool.connect();
        console.log('Connected!');

        const res = await client.query('SELECT * FROM subscription_plans');
        console.log('Plan Count:', res.rows.length);
        console.table(res.rows);

        client.release();
    } catch (err) {
        console.error('Error querying plans:', err);
    } finally {
        await localPool.end();
    }
}

checkPlans();
