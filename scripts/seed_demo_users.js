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

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to VPS Database');

        // 1. Create Customer
        const custPhone = '+97450000003';
        const custPass = 'customer@1234';
        const custHash = await bcrypt.hash(custPass, BCRYPT_ROUNDS);

        // Check if exists
        const custCheck = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [custPhone]);
        if (custCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name, is_active, language_preference)
                VALUES (gen_random_uuid(), $1, $2, 'customer', 'QScrap Customer', true, 'en');
            `, [custPhone, custHash]);
            console.log(`✅ Created Customer: ${custPhone}`);
        } else {
            console.log(`⚠️ Customer ${custPhone} already exists`);
        }

        // 2. Create Driver
        const driverPhone = '+97450000005';
        const driverPass = 'driver@1234';
        const driverHash = await bcrypt.hash(driverPass, BCRYPT_ROUNDS);

        let driverUserId;
        const driverCheck = await client.query('SELECT user_id FROM users WHERE phone_number = $1', [driverPhone]);

        if (driverCheck.rows.length === 0) {
            const res = await client.query(`
                INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name, is_active, language_preference)
                VALUES (gen_random_uuid(), $1, $2, 'driver', 'QScrap Driver', true, 'en')
                RETURNING user_id;
            `, [driverPhone, driverHash]);
            driverUserId = res.rows[0].user_id;
            console.log(`✅ Created Driver User: ${driverPhone}`);
        } else {
            driverUserId = driverCheck.rows[0].user_id;
            console.log(`⚠️ Driver User ${driverPhone} already exists`);
        }

        // 3. Create Driver Profile (if not exists)
        if (driverUserId) {
            const profileCheck = await client.query('SELECT driver_id FROM drivers WHERE user_id = $1', [driverUserId]);
            if (profileCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO drivers (driver_id, user_id, full_name, phone, status, is_active, vehicle_type, vehicle_plate)
                    VALUES (gen_random_uuid(), $1, 'QScrap Driver', $2, 'available', true, 'truck', 'QS-999');
                `, [driverUserId, driverPhone]);
                console.log(`✅ Created Driver Profile for User ID: ${driverUserId}`);
            } else {
                console.log(`⚠️ Driver Profile already exists`);
            }
        }

    } catch (err) {
        console.error('❌ Error seeding users:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
