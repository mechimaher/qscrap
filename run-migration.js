// Quick migration runner using Node.js
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
    const client = await pool.connect();
    try {
        console.log('📦 Reading migration file...');
        const sql = fs.readFileSync('./scripts/migrations/20260124_add_email_otp_system.sql', 'utf8');

        console.log('🚀 Running migration...');
        await client.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('Created:');
        console.log('  - email_otps table');
        console.log('  - email and email_verified columns in users table');
        console.log('  - Indexes for performance');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
