// Reset test user passwords
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

async function resetPasswords() {
    const client = await pool.connect();

    try {
        const hash = await bcrypt.hash('Test1234', 12);

        console.log('🔐 Resetting test user passwords to: Test1234\n');

        // Get users
        const users = await client.query(`
            SELECT user_id, phone_number, user_type, full_name
            FROM users
            WHERE phone_number IN ('+97450267974', '+97455906912', 'ops123456')
        `);

        for (const user of users.rows) {
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE user_id = $2',
                [hash, user.user_id]
            );
            console.log(`✅ Reset password for ${user.user_type}: ${user.phone_number}`);
        }

        console.log('\n✅ All passwords reset to: Test1234');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

resetPasswords();
