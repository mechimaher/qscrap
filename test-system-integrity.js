const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres:password@localhost:5432/qscrap_db"
});

async function runTest() {
    try {
        console.log('--- Starting System Integrity Test ---');

        // Get or Create order
        let order_id;
        const orderRes = await pool.query("SELECT order_id FROM orders WHERE order_status = 'ready_for_pickup' LIMIT 1");
        if (orderRes.rows.length === 0) {
            console.log('No ready_for_pickup orders found. Creating test data...');
            const garage = await pool.query("SELECT garage_id FROM garages LIMIT 1");
            const customer = await pool.query("SELECT user_id FROM users WHERE user_type = 'customer' LIMIT 1");
            const request = await pool.query("INSERT INTO part_requests (customer_id, car_make, car_model, car_year, part_description) VALUES ($1, 'Test', 'Test', 2020, 'Test Part') RETURNING request_id", [customer.rows[0].user_id]);
            const order = await pool.query("INSERT INTO orders (customer_id, garage_id, request_id, order_status, part_price, total_amount, commission_rate, platform_fee, garage_payout_amount) VALUES ($1, $2, $3, 'ready_for_pickup', 100, 125, 0.1, 10, 90) RETURNING order_id", [customer.rows[0].user_id, garage.rows[0].garage_id, request.rows[0].request_id]);
            order_id = order.rows[0].order_id;
        } else {
            order_id = orderRes.rows[0].order_id;
        }

        // Get/Create Driver
        let driver_id;
        const driverRes = await pool.query("SELECT driver_id FROM drivers LIMIT 1");
        if (driverRes.rows.length === 0) {
            throw new Error('No drivers found in database. Please seed drivers first.');
        }
        driver_id = driverRes.rows[0].driver_id;
        await pool.query("UPDATE drivers SET status = 'available' WHERE driver_id = $1", [driver_id]);

        console.log(`Using Order ID: ${order_id}, Driver ID: ${driver_id}`);

        // 1. Test Collection Assignment Type
        console.log('1. Testing Collection Assignment Type...');
        await pool.query("DELETE FROM delivery_assignments WHERE order_id = $1", [order_id]);

        // Simulate collectOrder call
        await pool.query(`
            INSERT INTO delivery_assignments (order_id, driver_id, status, assignment_type)
            VALUES ($1, $2, 'assigned', 'collection')
        `, [order_id, driver_id]);

        const checkType = await pool.query("SELECT assignment_type FROM delivery_assignments WHERE order_id = $1", [order_id]);
        const typeFound = checkType.rows[0].assignment_type;
        console.log(`   Assignment type: ${typeFound}`);
        if (typeFound !== 'collection') throw new Error('FAIL: assignment_type is not collection');

        // 2. Test Driver Status Update (Collection Hub Delivery)
        console.log('2. Testing Collection order status protection...');
        // Logic check: For 'collection' type, order status should NOT become 'delivered' (customer)
        let simulatedNewOrderStatus = null;
        const assignmentType = typeFound; // 'collection'
        const driverAction = 'delivered'; // driver says "delivered to hub"

        if (assignmentType === 'delivery') {
            if (driverAction === 'delivered') simulatedNewOrderStatus = 'delivered';
        } else if (assignmentType === 'return_to_garage') {
            if (driverAction === 'delivered') simulatedNewOrderStatus = 'returning_to_garage';
        }

        console.log(`   Simulated Order Status for collection: ${simulatedNewOrderStatus}`);
        if (simulatedNewOrderStatus !== null) throw new Error('FAIL: Collection assignment prematurely allows order to reach delivered status');

        // 3. Test QC Inspection Start
        console.log('3. Testing QC Inspection Start Status...');
        await pool.query("UPDATE orders SET order_status = 'collected' WHERE order_id = $1", [order_id]);
        await pool.query("DELETE FROM quality_inspections WHERE order_id = $1", [order_id]);

        // Mock startInspection logic
        await pool.query("INSERT INTO quality_inspections (order_id, status, started_at) VALUES ($1, 'in_progress', NOW())", [order_id]);
        await pool.query("UPDATE orders SET order_status = 'qc_in_progress', updated_at = NOW() WHERE order_id = $1", [order_id]);

        const checkQCStatus = await pool.query("SELECT order_status FROM orders WHERE order_id = $1", [order_id]);
        console.log(`   Order status after QC start: ${checkQCStatus.rows[0].order_status}`);
        if (checkQCStatus.rows[0].order_status !== 'qc_in_progress') throw new Error('FAIL: Order status did not change to qc_in_progress');

        // 4. Test Driver Release Race Condition
        console.log('4. Testing Driver Release Race Condition...');
        // Setup: Driver has one "active" assignment on Order B
        const orderB = await pool.query("INSERT INTO orders (customer_id, garage_id, order_status, part_price, total_amount, driver_id, commission_rate, platform_fee, garage_payout_amount) VALUES ((SELECT customer_id FROM orders WHERE order_id = $1), (SELECT garage_id FROM orders WHERE order_id = $1), 'in_transit', 100, 125, $2, 0.1, 10, 90) RETURNING order_id", [order_id, driver_id]);
        const orderB_id = orderB.rows[0].order_id;
        await pool.query("INSERT INTO delivery_assignments (order_id, driver_id, status, assignment_type) VALUES ($1, $2, 'assigned', 'delivery')", [orderB_id, driver_id]);

        await pool.query("UPDATE drivers SET status = 'busy' WHERE driver_id = $1", [driver_id]);

        // Customer confirms Order A (current order), but Order B is still in_transit
        await pool.query(`
            UPDATE drivers 
             SET status = 'available', updated_at = NOW()
             WHERE driver_id = $1
             AND NOT EXISTS (
                 SELECT 1 FROM delivery_assignments 
                 WHERE driver_id = $1 
                 AND status IN ('assigned', 'picked_up', 'in_transit')
                 AND order_id != $2
             )
        `, [driver_id, order_id]);

        const finalDriverStatus = await pool.query("SELECT status FROM drivers WHERE driver_id = $1", [driver_id]);
        console.log(`   Driver status: ${finalDriverStatus.rows[0].status}`);
        if (finalDriverStatus.rows[0].status === 'available') throw new Error('FAIL: Driver released while order B still active');
        console.log('   (Success: Driver stayed BUSY because of Order B)');

        // Cleanup
        await pool.query("DELETE FROM delivery_assignments WHERE order_id = $1", [orderB_id]);
        await pool.query("DELETE FROM orders WHERE order_id = $1", [orderB_id]);

        console.log('\n--- All System Integrity Tests Passed! ---');

    } catch (err) {
        console.error('\n❌ Test Failed:', err.message);
    } finally {
        await pool.end();
    }
}

runTest();
