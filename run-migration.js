const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'qscrap_db'
});

async function runMigration() {
    const sql = fs.readFileSync('src/config/migrations/20241220_driver_reassignment.sql', 'utf8');
    try {
        const result = await pool.query(sql);
        console.log('✅ Migration completed successfully');
        console.log(result[result.length - 1].rows[0]);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

runMigration();
