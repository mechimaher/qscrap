
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

async function runQueries() {
    console.log('--- Starting Deletion Query Test ---');
    const client = await pool.connect();

    // Use a dummy UUID to test schema validity without needing real data
    const userId = '00000000-0000-0000-0000-000000000000';

    try {
        console.log('1. Testing Orders Check...');
        await client.query(
            `SELECT COUNT(*) as count FROM orders 
             WHERE customer_id = $1 
             AND order_status IN ('paid', 'confirmed', 'processing', 'ready_for_pickup', 
                           'picked_up', 'in_transit', 'out_for_delivery')`,
            [userId]
        );
        console.log('✅ Orders Check Passed');

        console.log('2. Testing Tickets Check...');
        await client.query(
            `SELECT COUNT(*) as count FROM support_tickets 
             WHERE customer_id = $1 
             AND status IN ('open', 'in_progress')`,
            [userId]
        );
        console.log('✅ Tickets Check Passed');

        console.log('3. Testing Disputes Check...');
        await client.query(
            `SELECT COUNT(*) as count FROM disputes 
             WHERE customer_id = $1 
             AND status IN ('pending', 'open', 'under_review', 'awaiting_response')`,
            [userId]
        );
        console.log('✅ Disputes Check Passed');

        console.log('4. Testing Refunds Check...');
        await client.query(
            `SELECT COUNT(*) as count FROM refunds 
             WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id = $1)
             AND refund_status IN ('pending', 'processing')`,
            [userId]
        );
        console.log('✅ Refunds Check Passed');

        console.log('5. Testing Requests Check...');
        await client.query(
            `SELECT COUNT(DISTINCT r.request_id) as count 
             FROM part_requests r
             LEFT JOIN bids b ON r.request_id = b.request_id AND b.status = 'pending'
             WHERE r.customer_id = $1 
             AND r.status = 'active'
             AND b.bid_id IS NOT NULL`,
            [userId]
        );
        console.log('✅ Requests Check Passed');

    } catch (err: any) {
        console.error('❌ Query Failed!');
        console.error('Message:', err.message);
        console.error('Detail:', err.detail);
        console.error('Code:', err.code);
        if (err.position) console.error('Position:', err.position);
    } finally {
        client.release();
        await pool.end();
    }
}

runQueries();
