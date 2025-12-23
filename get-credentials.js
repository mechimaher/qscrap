// Get or create test credentials for QScrap
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

async function getOrCreateTestUsers() {
    const client = await pool.connect();

    try {
        console.log('\n🔍 Checking for existing test users...\n');

        // Check for existing users
        const existingUsers = await client.query(`
            SELECT user_id, phone_number, user_type, full_name, is_active, created_at
            FROM users 
            WHERE user_type IN ('customer', 'garage', 'operations')
            ORDER BY user_type, created_at
            LIMIT 10
        `);

        if (existingUsers.rows.length > 0) {
            console.log('✅ Found existing users:\n');
            console.log('═'.repeat(80));

            const grouped = {
                customer: [],
                garage: [],
                operations: []
            };

            existingUsers.rows.forEach(user => {
                grouped[user.user_type].push(user);
            });

            // Display credentials
            console.log('\n📱 CUSTOMER CREDENTIALS:');
            console.log('─'.repeat(80));
            if (grouped.customer.length > 0) {
                grouped.customer.forEach((user, i) => {
                    console.log(`${i + 1}. Phone: ${user.phone_number}`);
                    console.log(`   Name: ${user.full_name}`);
                    console.log(`   Password: Test1234 (default)`);
                    console.log(`   Status: ${user.is_active ? '✅ Active' : '❌ Inactive'}`);
                    console.log('');
                });
            } else {
                console.log('   No customers found. Creating one...\n');
                await createTestCustomer(client);
            }

            console.log('\n🏪 GARAGE CREDENTIALS:');
            console.log('─'.repeat(80));
            if (grouped.garage.length > 0) {
                grouped.garage.forEach((user, i) => {
                    console.log(`${i + 1}. Phone: ${user.phone_number}`);
                    console.log(`   Name: ${user.full_name}`);
                    console.log(`   Password: Test1234 (default)`);
                    console.log(`   Status: ${user.is_active ? '✅ Active' : '❌ Inactive'}`);
                    console.log('');
                });
            } else {
                console.log('   No garages found. Creating one...\n');
                await createTestGarage(client);
            }

            console.log('\n⚙️  OPERATIONS CREDENTIALS:');
            console.log('─'.repeat(80));
            if (grouped.operations.length > 0) {
                grouped.operations.forEach((user, i) => {
                    console.log(`${i + 1}. Phone: ${user.phone_number}`);
                    console.log(`   Name: ${user.full_name}`);
                    console.log(`   Password: Test1234 (default)`);
                    console.log(`   Status: ${user.is_active ? '✅ Active' : '❌ Inactive'}`);
                    console.log('');
                });
            } else {
                console.log('   No operations users found. Creating one...\n');
                await createTestOperations(client);
            }

        } else {
            console.log('⚠️  No users found. Creating test users...\n');
            await createTestCustomer(client);
            await createTestGarage(client);
            await createTestOperations(client);
        }

        console.log('\n═'.repeat(80));
        console.log('\n💡 TIP: All test accounts use password: Test1234');
        console.log('🔗 Login at: http://localhost:3000/customer-dashboard.html');
        console.log('🔗 Login at: http://localhost:3000/garage-dashboard.html');
        console.log('🔗 Login at: http://localhost:3000/operations-dashboard.html\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

async function createTestCustomer(client) {
    const hash = await bcrypt.hash('Test1234', 12);
    const phone = '+97450000001';

    await client.query('BEGIN');
    try {
        const result = await client.query(
            'INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [phone, hash, 'customer', 'Test Customer']
        );
        await client.query('COMMIT');
        console.log(`   ✅ Created customer: ${phone} / Test1234`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.log(`   ⚠️  Customer may already exist: ${phone}`);
    }
}

async function createTestGarage(client) {
    const hash = await bcrypt.hash('Test1234', 12);
    const phone = '+97450000002';

    await client.query('BEGIN');
    try {
        const result = await client.query(
            'INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [phone, hash, 'garage', 'Test Garage Owner']
        );
        const userId = result.rows[0].user_id;

        await client.query(
            'INSERT INTO garages (garage_id, garage_name, address) VALUES ($1, $2, $3)',
            [userId, 'Test Auto Parts Garage', 'Doha, Qatar']
        );

        // Get starter plan
        const planResult = await client.query(
            "SELECT plan_id FROM subscription_plans WHERE plan_code = 'starter' AND is_active = true LIMIT 1"
        );
        const planId = planResult.rows.length > 0 ? planResult.rows[0].plan_id : null;

        await client.query(
            `INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end, trial_ends_at)
             VALUES ($1, $2, 'trial', CURRENT_DATE, CURRENT_DATE + 30, NOW() + INTERVAL '30 days')`,
            [userId, planId]
        );

        await client.query('COMMIT');
        console.log(`   ✅ Created garage: ${phone} / Test1234`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.log(`   ⚠️  Garage may already exist: ${phone}`);
    }
}

async function createTestOperations(client) {
    const hash = await bcrypt.hash('Test1234', 12);
    const phone = '+97450000003';

    await client.query('BEGIN');
    try {
        await client.query(
            'INSERT INTO users (phone_number, password_hash, user_type, full_name) VALUES ($1, $2, $3, $4)',
            [phone, hash, 'operations', 'Operations Manager']
        );
        await client.query('COMMIT');
        console.log(`   ✅ Created operations: ${phone} / Test1234`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.log(`   ⚠️  Operations user may already exist: ${phone}`);
    }
}

getOrCreateTestUsers();
