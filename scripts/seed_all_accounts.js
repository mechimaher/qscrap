const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432')
});

const BCRYPT_ROUNDS = 12;

async function seedAllAccounts() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to VPS Database');
        console.log('🌱 Seeding all demo accounts...\n');

        // ========== 1. ADMIN ==========
        const adminLogin = '+97450000001';
        const adminPass = 'admin@1234';
        const adminHash = await bcrypt.hash(adminPass, BCRYPT_ROUNDS);

        const adminCheck = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [adminLogin]);
        if (adminCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name, is_active, language_preference)
                VALUES (gen_random_uuid(), $1, $2, 'admin', 'QScrap Admin', true, 'en');
            `, [adminLogin, adminHash]);
            console.log('✅ Created Admin: ' + adminLogin);
        } else {
            console.log('⚠️ Admin already exists: ' + adminLogin);
        }

        // ========== 2. OPERATIONS STAFF ==========
        const opsPhone = '+97450000002';
        const opsPass = 'ops@1234';
        const opsHash = await bcrypt.hash(opsPass, BCRYPT_ROUNDS);

        let opsUserId;
        const opsCheck = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [opsPhone]);

        if (opsCheck.rows.length === 0) {
            const res = await client.query(`
                INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name, is_active, language_preference)
                VALUES (gen_random_uuid(), $1, $2, 'staff', 'QScrap Operations', true, 'en')
                RETURNING user_id;
            `, [opsPhone, opsHash]);
            opsUserId = res.rows[0].user_id;
            console.log('✅ Created Operations User: ' + opsPhone);
        } else {
            opsUserId = opsCheck.rows[0].user_id;
            console.log('⚠️ Operations User already exists: ' + opsPhone);
        }

        // Create staff profile for operations
        if (opsUserId) {
            const profileCheck = await client.query('SELECT staff_id FROM staff_profiles WHERE user_id = $1', [opsUserId]);
            if (profileCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO staff_profiles (staff_id, user_id, role, department, employee_id, is_active)
                    VALUES (gen_random_uuid(), $1, 'operations', 'Operations', 'OPS-001', true);
                `, [opsUserId]);
                console.log('  └─ Created Staff Profile for Operations');
            } else {
                console.log('  └─ Staff Profile already exists');
            }
        }

        // ========== 3. GARAGE MANAGER ==========
        const garagePhone = '+97450000004';
        const garagePass = 'garage@1234';
        const garageHash = await bcrypt.hash(garagePass, BCRYPT_ROUNDS);

        let garageUserId;
        const garageCheck = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [garagePhone]);

        if (garageCheck.rows.length === 0) {
            const res = await client.query(`
                INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name, is_active, language_preference)
                VALUES (gen_random_uuid(), $1, $2, 'garage', 'QScrap Demo Garage', true, 'en')
                RETURNING user_id;
            `, [garagePhone, garageHash]);
            garageUserId = res.rows[0].user_id;
            console.log('✅ Created Garage Manager: ' + garagePhone);
        } else {
            garageUserId = garageCheck.rows[0].user_id;
            console.log('⚠️ Garage Manager already exists: ' + garagePhone);
        }

        // Create garage record
        if (garageUserId) {
            // Check if garage exists for this manager
            const garageRecordCheck = await client.query(
                `SELECT garage_id FROM garages WHERE phone_number = $1`,
                [garagePhone]
            );

            if (garageRecordCheck.rows.length === 0) {
                const garageRes = await client.query(`
                    INSERT INTO garages (
                        garage_id, garage_name, phone_number, address, 
                        is_verified, approval_status, supplier_type, all_brands
                    ) VALUES (
                        $1, 
                        'QScrap Demo Garage', 
                        $2, 
                        'Industrial Area, Doha, Qatar',
                        true,
                        'approved',
                        'both',
                        true
                    ) RETURNING garage_id;
                `, [garageUserId, garagePhone]);
                console.log('  └─ Created Garage Record: ' + garageRes.rows[0].garage_id);
            } else {
                console.log('  └─ Garage Record already exists');
            }
        }

        console.log('\n========================================');
        console.log('✅ All demo accounts seeded successfully!');
        console.log('========================================');
        console.log('\nTest Credentials:');
        console.log('─────────────────');
        console.log('Admin:      +97450000001 / admin@1234');
        console.log('Operations: +97450000002 / ops@1234');
        console.log('Garage:     +97450000004 / garage@1234');
        console.log('Customer:   +97450000003 / customer@1234');
        console.log('Driver:     +97450000005 / driver@1234');

    } catch (err) {
        console.error('❌ Error seeding accounts:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedAllAccounts();
