
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'qscrap_db',
    password: 'password',
    port: 5432,
});

async function checkSchema() {
    try {
        const client = await pool.connect();

        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'garage_subscriptions'
        `);

        console.log('Columns in garage_subscriptions:');
        console.table(res.rows);

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
