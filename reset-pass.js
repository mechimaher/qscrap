const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'qscrap_db'
});

async function resetPasswords() {
    try {
        const newPassword = 'Test@1234';
        const hash = await bcrypt.hash(newPassword, 12);

        // Reset all user passwords
        const result = await pool.query(
            'UPDATE users SET password_hash = $1 RETURNING phone_number, user_type',
            [hash]
        );

        console.log(`\n✅ Reset passwords for ${result.rowCount} users to: ${newPassword}\n`);
        result.rows.forEach(row => {
            console.log(`  ${row.user_type}: ${row.phone_number}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

resetPasswords();
