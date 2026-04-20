"use strict";
// Create Admin User Script
// Build: npm run build
// Run from dist folder: node scripts/create-admin.js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
async function createAdmin() {
    const phone = '+97412345678';
    const password = 'Admin@123';
    const email = 'admin@qscrap.qa';
    const fullName = 'QScrap Administrator';
    try {
        // Check if admin already exists
        const existing = await db_1.default.query(`SELECT * FROM users WHERE phone_number = $1 OR user_type = 'admin' LIMIT 1`, [phone]);
        if (existing.rows.length > 0) {
            console.log('Admin already exists:');
            console.log('Phone:', existing.rows[0].phone_number);
            console.log('Type:', existing.rows[0].user_type);
            process.exit(0);
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create admin user
        const result = await db_1.default.query(`
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
    }
    catch (err) {
        console.error('Error creating admin:', err.message);
    }
    finally {
        await db_1.default.end();
    }
}
createAdmin();
