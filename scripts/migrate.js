const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

const MIGRATIONS_DIR = path.join(__dirname, '../src/config/migrations');
const SCHEMA_FILE = path.join(__dirname, '../src/config/database.sql');

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to database');

        // 1. Create migrations table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Get applied migrations
        const { rows: appliedRows } = await client.query('SELECT name FROM migrations');
        const appliedMigrations = new Set(appliedRows.map(row => row.name));

        // 3. Get all migration files
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Ensure chronological order

        // 4. Apply pending migrations
        let appliedCount = 0;
        for (const file of files) {
            if (!appliedMigrations.has(file)) {
                console.log(`🚀 Applying migration: ${file}`);
                const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

                try {
                    await client.query('BEGIN');
                    await client.query(sql);
                    await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`✅ Applied: ${file}`);
                    appliedCount++;
                } catch (err) {
                    await client.query('ROLLBACK');
                    console.error(`❌ Failed to apply ${file}:`, err.message);
                    throw err;
                }
            }
        }

        if (appliedCount === 0) {
            console.log('✨ No new migrations to apply');
        } else {
            console.log(`🎉 Successfully applied ${appliedCount} migrations`);

            // 5. Update database.sql
            console.log('📦 Updating database.sql...');
            await updateSchemaFile();
        }

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

function updateSchemaFile() {
    return new Promise((resolve, reject) => {
        const cmd = `pg_dump -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} -p ${process.env.DB_PORT || '5432'} --schema-only --no-owner --no-privileges ${process.env.DB_NAME || 'qscrap_db'} > "${SCHEMA_FILE}"`;

        // Set password for pg_dump
        const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || 'password' };

        exec(cmd, { env }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error updating schema file: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                // pg_dump writes to stderr for info messages too, so just log it
                // console.log(`pg_dump output: ${stderr}`);
            }
            console.log('✅ database.sql updated successfully');
            resolve();
        });
    });
}

runMigrations();
