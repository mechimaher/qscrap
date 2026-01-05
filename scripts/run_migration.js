// Quick migration runner script
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function runMigration() {
    const client = await pool.connect();
    console.log('Connected to database. Running migration...');

    try {
        // 1. Fix users table - add 'operations' user type
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check`);
        await client.query(`ALTER TABLE users ADD CONSTRAINT users_user_type_check 
            CHECK (user_type IN ('customer', 'garage', 'driver', 'admin', 'operations'))`);
        console.log('✓ Fixed users.user_type constraint');

        // 2. Fix order_status_history - add 'operations' to changed_by_type
        await client.query(`ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_changed_by_type_check`);
        await client.query(`ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_changed_by_type_check 
            CHECK (changed_by_type IN ('customer', 'garage', 'driver', 'system', 'admin', 'operations'))`);
        console.log('✓ Fixed order_status_history.changed_by_type constraint');

        // 3. Add UNIQUE constraint to quality_inspections.order_id
        await client.query(`ALTER TABLE quality_inspections DROP CONSTRAINT IF EXISTS quality_inspections_order_id_key`);
        await client.query(`ALTER TABLE quality_inspections ADD CONSTRAINT quality_inspections_order_id_key UNIQUE (order_id)`);
        console.log('✓ Added UNIQUE constraint to quality_inspections.order_id');

        // 4. Add columns to quality_inspections if missing
        await client.query(`ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS result VARCHAR(20)`);
        await client.query(`ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS part_grade VARCHAR(5)`);
        await client.query(`ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS condition_assessment VARCHAR(50)`);
        await client.query(`ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS item_notes JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS failure_category VARCHAR(50)`);
        console.log('✓ Added missing columns to quality_inspections');

        // 5. Add UNIQUE constraint to delivery_assignments.order_id
        await client.query(`ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_order_id_key`);
        await client.query(`ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_order_id_key UNIQUE (order_id)`);
        console.log('✓ Added UNIQUE constraint to delivery_assignments.order_id');

        // 6. Add columns to delivery_assignments if missing
        await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(30) DEFAULT 'delivery'`);
        await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8)`);
        await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8)`);
        await client.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP`);
        console.log('✓ Added missing columns to delivery_assignments');

        // 7. Create disputes table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS disputes (
                dispute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
                customer_id UUID REFERENCES users(user_id),
                garage_id UUID REFERENCES garages(garage_id),
                reason VARCHAR(50) NOT NULL,
                description TEXT,
                photo_urls TEXT[] DEFAULT '{}',
                order_amount DECIMAL(10,2) NOT NULL,
                refund_percent INT NOT NULL DEFAULT 0,
                restocking_fee_percent INT DEFAULT 0,
                refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                status VARCHAR(30) DEFAULT 'pending',
                garage_response TEXT,
                garage_responded_at TIMESTAMP,
                resolved_by UUID REFERENCES users(user_id),
                resolution_notes TEXT,
                resolved_at TIMESTAMP,
                auto_resolve_at TIMESTAMP DEFAULT NOW() + INTERVAL '48 hours',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✓ Created disputes table');

        // 8. Fix orders table - ensure all order statuses
        await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check`);
        await client.query(`ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
            CHECK (order_status IN (
                'confirmed', 'preparing', 'ready_for_pickup', 'ready_for_collection', 'collected', 
                'qc_in_progress', 'qc_passed', 'qc_failed', 'returning_to_garage',
                'in_transit', 'delivered', 'completed',
                'cancelled_by_customer', 'cancelled_by_garage', 'cancelled_by_ops', 
                'disputed', 'refunded'
            ))`);
        console.log('✓ Fixed orders.order_status constraint');

        // 9. Add is_suspended column to users if missing
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT`);
        console.log('✓ Added is_suspended columns to users');

        console.log('\n✅ Migration completed successfully!');
    } catch (err) {
        console.error('Migration error:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
