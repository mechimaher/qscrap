// Create Admin User Script
// Build: npm run build
// Run from dist folder: node scripts/create-admin.js

import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../config/security';
import pool from '../config/db';

async function createAdmin() {
    const phone = '+97412345678';
    const password = 'Admin@123';
    const email = 'admin@qscrap.qa';
    const fullName = 'QScrap Administrator';

    try {
        // Check if admin already exists
        const existing = await pool.query(
            `SELECT * FROM users WHERE phone_number = $1 OR user_type = 'admin' LIMIT 1`,
            [phone]
        );

        if (existing.rows.length > 0) {
            console.log('Admin already exists:');
            console.log('Phone:', existing.rows[0].phone_number);
            console.log('Type:', existing.rows[0].user_type);
            process.exit(0);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create admin user
        const result = await pool.query(`
            INSERT INTO users (phone_number, password_hash, user_type, full_name, email, is_active)
            VALUES ($1, $2, 'admin', $3, $4, true)
            RETURNING user_id, phone_number, user_type, full_name, email
        `, [phone, passwordHash, fullName, email]);

        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('=================================');
        console.log('ADMIN CREDENTIALS');
        console.log('=================================');
        console.log('Phone:', phone);
        console.log('Password:', password);
        console.log('Email:', email);
        console.log('=================================');
        console.log('');
        console.log('Login at: http://localhost:3000/admin-dashboard.html');

    } catch (err: any) {
        console.error('Error creating admin:', err.message);
    } finally {
        await pool.end();
    }
}

createAdmin();
