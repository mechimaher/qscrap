/**
 * Database Migration Runner
 * 
 * Commands:
 *   npm run db:migrate           - Apply pending migrations
 *   npm run db:migrate status    - Show applied vs pending migrations
 *   npm run db:migrate dry-run   - Preview pending migrations without applying
 *   npm run db:migrate redo      - Reapply the last migration (for dev iteration)
 * 
 * Migration files: src/config/migrations/*.sql
 * Tracking table: migrations (name, applied_at, checksum)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const TOLERATE_IDEMPOTENT_ERRORS = process.env.MIGRATION_TOLERANT === 'true';

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Ensure migrations tracking table exists with checksum support
 */
async function ensureMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            checksum VARCHAR(64),
            applied_at TIMESTAMP DEFAULT NOW()
        );
    `);

    // Add checksum column if missing (upgrade from old schema)
    await client.query(`
        ALTER TABLE migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
    `);
}

/**
 * Get SHA-256 checksum of a migration file
 */
function getFileChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Get all migration files sorted chronologically
 */
function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
        process.exit(1);
    }

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
}

// ============================================
// COMMANDS
// ============================================

/**
 * Apply all pending migrations
 */
async function applyMigrations(dryRun = false) {
    const client = await pool.connect();
    try {
        console.log(`🔌 Connected to ${process.env.DB_NAME || 'qscrap_db'}@${process.env.DB_HOST || 'localhost'}`);

        await ensureMigrationsTable(client);

        // Get applied migrations
        const { rows: appliedRows } = await client.query(
            'SELECT name, checksum FROM migrations ORDER BY applied_at'
        );
        const appliedMap = new Map(appliedRows.map(row => [row.name, row.checksum]));

        // Get all migration files
        const files = getMigrationFiles();

        // Check for modified migrations (checksum mismatch)
        for (const file of files) {
            if (appliedMap.has(file)) {
                const currentChecksum = getFileChecksum(path.join(MIGRATIONS_DIR, file));
                const storedChecksum = appliedMap.get(file);
                if (storedChecksum && currentChecksum !== storedChecksum) {
                    console.warn(`⚠️  WARNING: ${file} has been modified since it was applied`);
                }
            }
        }

        // Find pending migrations
        const pending = files.filter(file => !appliedMap.has(file));

        if (pending.length === 0) {
            console.log('✨ No new migrations to apply');
            console.log(`   Total: ${files.length} migrations (all applied)`);
            return;
        }

        if (dryRun) {
            console.log(`\n📋 DRY RUN — ${pending.length} migration(s) would be applied:\n`);
            for (const file of pending) {
                const filePath = path.join(MIGRATIONS_DIR, file);
                const stats = fs.statSync(filePath);
                console.log(`   ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
            }
            console.log('\n   Run without "dry-run" to apply.');
            return;
        }

        // Apply pending migrations
        let appliedCount = 0;
        const startTime = Date.now();

        for (const file of pending) {
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            const checksum = getFileChecksum(filePath);

            console.log(`🚀 Applying: ${file}`);
            const migrationStart = Date.now();

            try {
                await client.query('BEGIN');
                try {
                    await client.query(sql);
                } catch (sqlErr) {
                    // Strict by default: fail on SQL errors.
                    // Legacy compatibility mode can be enabled with MIGRATION_TOLERANT=true.
                    const isIdempotentConflict = (
                        sqlErr.code === '42P07' || // duplicate_table
                        sqlErr.code === '42710' || // duplicate_object
                        sqlErr.code === '42701' || // duplicate_column
                        sqlErr.code === '42P01'    // undefined_table (common in down/cleanup scripts)
                    );

                    if (TOLERATE_IDEMPOTENT_ERRORS && isIdempotentConflict) {
                        console.warn(`   ⚠️  Tolerated idempotent conflict: ${sqlErr.message}`);
                    } else {
                        throw sqlErr;
                    }
                }
                await client.query(
                    'INSERT INTO migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET checksum = $2',
                    [file, checksum]
                );
                await client.query('COMMIT');

                const duration = Date.now() - migrationStart;
                console.log(`   ✅ Applied in ${duration}ms`);
                appliedCount++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`   ❌ FAILED: ${err.message}`);
                console.error(`   ⏹  Halting — ${appliedCount} of ${pending.length} migrations applied`);
                throw err;
            }
        }

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n🎉 Applied ${appliedCount} migration(s) in ${totalDuration}s`);

        // Update schema dump in development
        if (process.env.NODE_ENV !== 'production') {
            console.log('📦 Updating database.sql...');
            await updateSchemaFile();
        }

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * Show migration status
 */
async function showStatus() {
    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);

        const { rows: appliedRows } = await client.query(
            'SELECT name, checksum, applied_at FROM migrations ORDER BY applied_at'
        );
        const appliedMap = new Map(appliedRows.map(row => [row.name, row]));
        const files = getMigrationFiles();

        console.log(`\n📊 Migration Status (${process.env.DB_NAME || 'qscrap_db'})\n`);
        console.log(`   ${'Status'.padEnd(10)} ${'Migration'.padEnd(52)} Applied`);
        console.log(`   ${'─'.repeat(10)} ${'─'.repeat(52)} ${'─'.repeat(20)}`);

        let appliedCount = 0;
        let pendingCount = 0;

        for (const file of files) {
            const applied = appliedMap.get(file);
            if (applied) {
                const date = new Date(applied.applied_at).toISOString().slice(0, 16).replace('T', ' ');
                console.log(`   ${'✅ applied'.padEnd(10)} ${file.padEnd(52)} ${date}`);
                appliedCount++;
            } else {
                console.log(`   ${'⏳ pending'.padEnd(10)} ${file.padEnd(52)} —`);
                pendingCount++;
            }
        }

        console.log(`\n   Total: ${files.length} | Applied: ${appliedCount} | Pending: ${pendingCount}\n`);

    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * Redo the last applied migration (dev only)
 */
async function redoLast() {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ "redo" is not allowed in production');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);

        const { rows } = await client.query(
            'SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 1'
        );

        if (rows.length === 0) {
            console.log('No migrations to redo');
            return;
        }

        const lastMigration = rows[0].name;
        console.log(`🔄 Redoing last migration: ${lastMigration}`);

        // Remove tracking record
        await client.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
        console.log('   Removed tracking record');

        // Re-apply
        const filePath = path.join(MIGRATIONS_DIR, lastMigration);
        if (!fs.existsSync(filePath)) {
            console.error(`   ❌ Migration file not found: ${lastMigration}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        const checksum = getFileChecksum(filePath);

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
            'INSERT INTO migrations (name, checksum) VALUES ($1, $2)',
            [lastMigration, checksum]
        );
        await client.query('COMMIT');
        console.log(`   ✅ Reapplied: ${lastMigration}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Redo failed: ${err.message}`);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * Update database.sql schema dump (development only)
 */
function updateSchemaFile() {
    return new Promise((resolve, reject) => {
        const containerName = 'qscrap-postgres';
        const dbUser = process.env.DB_USER || 'postgres';
        const dbName = process.env.DB_NAME || 'qscrap_db';

        const cmd = `docker exec ${containerName} pg_dump -U ${dbUser} --schema-only --no-owner --no-privileges ${dbName} > "${SCHEMA_FILE}"`;

        exec(cmd, (error) => {
            if (error) {
                console.warn(`   ⚠️  Could not update schema file: ${error.message}`);
                resolve(); // Don't fail the migration over schema dump
                return;
            }
            console.log('   ✅ database.sql updated');
            resolve();
        });
    });
}

// ============================================
// CLI ENTRY POINT
// ============================================

const command = process.argv[2] || 'up';

switch (command) {
    case 'up':
    case 'apply':
        applyMigrations(false);
        break;
    case 'dry-run':
    case 'dryrun':
        applyMigrations(true);
        break;
    case 'status':
        showStatus();
        break;
    case 'redo':
        redoLast();
        break;
    default:
        console.log('Usage: npm run db:migrate [command]');
        console.log('');
        console.log('Commands:');
        console.log('  (no args)    Apply pending migrations');
        console.log('  status       Show applied vs pending');
        console.log('  dry-run      Preview without applying');
        console.log('  redo         Reapply last migration (dev only)');
        process.exit(0);
}
