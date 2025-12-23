// Run audit_logs migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'qscrap_db',
        port: parseInt(process.env.DB_PORT || '5432')
    });

    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        const migrationPath = path.join(__dirname, 'migrations', '003_audit_logs.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running audit_logs migration...');
        await client.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify table exists
        const result = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name = 'audit_logs'
        `);

        if (result.rows.length > 0) {
            console.log('✅ audit_logs table verified');
        }

        client.release();
        await pool.end();

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
