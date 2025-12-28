/**
 * Database Reset & Test Account Setup Script
 * 
 * This script:
 * 1. Clears all data from tables (keeping schema intact)
 * 2. Creates an admin account
 * 3. Creates test accounts for each user type
 * 4. Sets up initial required data (subscription plans, inspection criteria)
 * 
 * Run: node reset-and-seed.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Admin account configuration (only admin - other accounts created via dashboard)
const ADMIN_ACCOUNT = {
    phone_number: '50000001',
    password: 'Admin@123',
    full_name: 'System Administrator',
    user_type: 'admin'
};

async function resetDatabase() {
    const client = await pool.connect();

    try {
        console.log('\n🔄 Starting Database Reset...\n');

        await client.query('BEGIN');

        // ==========================================
        // STEP 1: Clear all data using TRUNCATE CASCADE
        // ==========================================
        console.log('📋 Clearing existing data...');

        // Use TRUNCATE CASCADE to bypass FK constraints
        const tablesToClear = [
            'users',
            'garages',
            'drivers',
            'orders',
            'bids',
            'part_requests',
            'notifications'
        ];

        try {
            // Truncate users table cascades to all dependent tables
            await client.query('TRUNCATE TABLE users CASCADE');
            console.log('   ✓ Truncated all user data (CASCADE)');
        } catch (err) {
            console.log(`   ⚠ Truncate failed: ${err.message.slice(0, 50)}`);
        }

        // Reset sequences
        console.log('\n📋 Resetting sequences...');
        try {
            await client.query(`ALTER SEQUENCE IF EXISTS order_number_seq RESTART WITH 1`);
            console.log('   ✓ Reset: order_number_seq');
        } catch (err) {
            console.log('   ⚠ Sequence reset skipped');
        }

        // ==========================================
        // STEP 2: Ensure subscription plans exist
        // ==========================================
        console.log('\n📋 Setting up subscription plans...');

        await client.query(`
            INSERT INTO subscription_plans (plan_code, plan_name, plan_name_ar, monthly_fee, commission_rate, max_bids_per_month, features, display_order) 
            VALUES
            ('starter', 'Starter', 'المبتدئ', 199.00, 0.180, 30, '{"analytics": "basic", "support": "email", "badge": null}', 1),
            ('professional', 'Professional', 'المحترف', 499.00, 0.150, NULL, '{"analytics": "advanced", "support": "priority", "badge": "pro", "priority_listing": true}', 2),
            ('enterprise', 'Enterprise', 'المؤسسة', 999.00, 0.120, NULL, '{"analytics": "premium", "support": "dedicated", "badge": "enterprise", "priority_listing": true, "featured": true}', 3)
            ON CONFLICT (plan_code) DO NOTHING
        `);
        console.log('   ✓ Subscription plans ready');

        // ==========================================
        // STEP 3: Ensure inspection criteria exist
        // ==========================================
        console.log('\n📋 Setting up inspection criteria...');

        await client.query(`
            INSERT INTO inspection_criteria (name, description, category, is_required, sort_order) VALUES
            ('Part Matches Description', 'Verify part matches the description in the order', 'identification', true, 1),
            ('Correct Part Number', 'Confirm OEM/aftermarket part number is correct', 'identification', true, 2),
            ('No Physical Damage', 'Check for cracks, dents, scratches or other damage', 'condition', true, 3),
            ('No Rust/Corrosion', 'Inspect for rust, corrosion, or oxidation', 'condition', true, 4),
            ('Complete with All Components', 'Verify all mounting hardware and components included', 'completeness', true, 5),
            ('Properly Packaged', 'Part is packaged safely for delivery', 'packaging', true, 6),
            ('Clean Condition', 'Part is clean and presentable', 'condition', false, 7),
            ('Functional Test Passed', 'For electrical/mechanical parts - test if applicable', 'function', false, 8)
            ON CONFLICT DO NOTHING
        `);
        console.log('   ✓ Inspection criteria ready');

        // ==========================================
        // STEP 4: Create admin account only
        // ==========================================
        console.log('\n📋 Creating admin account...\n');

        const passwordHash = await bcrypt.hash(ADMIN_ACCOUNT.password, 12);

        await client.query(`
            INSERT INTO users (phone_number, password_hash, user_type, full_name, is_active)
            VALUES ($1, $2, $3, $4, true)
        `, [ADMIN_ACCOUNT.phone_number, passwordHash, ADMIN_ACCOUNT.user_type, ADMIN_ACCOUNT.full_name]);

        console.log(`   ✅ Created ADMIN: ${ADMIN_ACCOUNT.phone_number}`);

        await client.query('COMMIT');

        // ==========================================
        // SUMMARY
        // ==========================================
        console.log('\n' + '═'.repeat(60));
        console.log('✅ DATABASE RESET COMPLETE');
        console.log('═'.repeat(60));
        console.log('\n📋 Admin Account Created:\n');
        console.log('   Phone:    ' + ADMIN_ACCOUNT.phone_number);
        console.log('   Password: ' + ADMIN_ACCOUNT.password);
        console.log('   Name:     ' + ADMIN_ACCOUNT.full_name);

        console.log('\n📌 Next Steps:');
        console.log('   1. Login to Admin Dashboard: http://localhost:3000/admin-dashboard.html');
        console.log('   2. Create other accounts (customer, garage, driver, ops) via Admin panel');
        console.log('\n📌 Other Dashboard URLs:');
        console.log('   • Garage:     http://localhost:3000/garage-dashboard.html');
        console.log('   • Customer:   http://localhost:3000/customer-dashboard.html');
        console.log('   • Operations: http://localhost:3000/operations-dashboard.html');
        console.log('   • API Docs:   http://localhost:3000/api/docs');
        console.log('\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run
resetDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
