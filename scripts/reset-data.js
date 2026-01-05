// Reset all transactional data while keeping users and garages
// Run with: node reset-data.js

const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'qscrap_db',
    password: 'postgres',
    port: 5432
});

async function resetData() {
    const client = await pool.connect();

    try {
        console.log('🗑️  Starting data reset...\n');

        // Disable foreign key checks temporarily
        await client.query('SET session_replication_role = replica;');

        // Tables to truncate (order matters due to foreign keys)
        const tablesToTruncate = [
            // Chat & Support
            'support_messages',
            'support_tickets',

            // Reviews
            'reviews',

            // Disputes
            'disputes',

            // Payments & Finance
            'refunds',
            'garage_payouts',

            // Documents
            'invoices',

            // Delivery
            'delivery_assignments',

            // Quality Control
            'quality_inspections',

            // Orders & Status
            'order_status_history',
            'orders',

            // Bids
            'bids',

            // Requests
            'part_requests',

            // Customer addresses (optional - keep if you want)
            // 'customer_addresses',

            // Subscriptions
            'subscription_history',
        ];

        for (const table of tablesToTruncate) {
            try {
                await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                console.log(`✅ Truncated: ${table}`);
            } catch (err) {
                console.log(`⚠️  Skipped (may not exist): ${table}`);
            }
        }

        // Reset drivers to available
        await client.query(`UPDATE drivers SET status = 'available', total_deliveries = 0`);
        console.log('✅ Reset drivers to available');

        // Reset garage stats
        await client.query(`UPDATE garages SET rating_average = 0, rating_count = 0, total_orders = 0`);
        console.log('✅ Reset garage stats');

        // Re-enable foreign key checks
        await client.query('SET session_replication_role = DEFAULT;');

        console.log('\n✨ Data reset complete!');
        console.log('📋 Kept: users, garages, drivers, customer_addresses');
        console.log('🧪 Ready for testing!');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

resetData();
