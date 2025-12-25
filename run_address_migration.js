// Run Address Module Migration
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function runMigration() {
    const client = await pool.connect();
    console.log('Connected to database. Running address migration...');

    try {
        const sql = fs.readFileSync('./src/config/migrations/20251224_address_module.sql', 'utf8');
        await client.query(sql);
        console.log('✅ Address migration completed successfully!');
    } catch (err) {
        console.error('Migration error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
