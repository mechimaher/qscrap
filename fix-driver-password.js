// Fix driver password script
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/qscrap_db'
});

async function fixDriverPassword() {
    try {
        // Generate correct password hash
        const password = 'Test1234';
        const hash = await bcrypt.hash(password, 12);
        console.log('Generated hash:', hash);

        // Update the driver user
        const result = await pool.query(
            `UPDATE users SET password_hash = $1 WHERE phone_number = '+97450266775' AND user_type = 'driver' RETURNING user_id, phone_number`,
            [hash]
        );

        if (result.rows.length > 0) {
            console.log('✅ Password updated for:', result.rows[0].phone_number);
            console.log('   User ID:', result.rows[0].user_id);
        } else {
            console.log('❌ No driver found with that phone number');
        }

        // Verify the hash works
        const verifyResult = await pool.query(
            `SELECT password_hash FROM users WHERE phone_number = '+97450266775' AND user_type = 'driver'`
        );

        if (verifyResult.rows.length > 0) {
            const isValid = await bcrypt.compare(password, verifyResult.rows[0].password_hash);
            console.log('✅ Password verification:', isValid ? 'SUCCESS' : 'FAILED');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixDriverPassword();
