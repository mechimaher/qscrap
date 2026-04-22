
const { Pool } = require('pg');
require('dotenv').config();

// Production Database Connection
// Note: In production, these should be picked up from process.env 
// via the docker container environment
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'qscrap_db'
});

async function runFixes() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Production DB Schema Fixes ---');

        // 1. Fix customer_addresses updated_at
        console.log('Checking customer_addresses table...');
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add updated_at if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_addresses' AND column_name='updated_at') THEN 
                    ALTER TABLE customer_addresses ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(); 
                    RAISE NOTICE 'Column updated_at added to customer_addresses';
                END IF;

                -- Create/Update trigger function
                CREATE OR REPLACE FUNCTION public.update_address_modtime() RETURNS trigger
                    LANGUAGE plpgsql
                    AS $func$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $func$;

                -- Re-create trigger
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_address_modtime') THEN
                    CREATE TRIGGER trg_update_address_modtime
                        BEFORE UPDATE ON customer_addresses
                        FOR EACH ROW
                        EXECUTE FUNCTION public.update_address_modtime();
                    RAISE NOTICE 'Trigger trg_update_address_modtime created';
                END IF;
            END $$;
        `);

        // 2. Fix other missing columns mentioned in logs
        // [DELIVERY-REMINDERS] often uses orders or delivery_assignments
        console.log('Checking delivery_assignments table...');
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add updated_at to delivery_assignments if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_assignments' AND column_name='updated_at') THEN 
                    ALTER TABLE delivery_assignments ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(); 
                    RAISE NOTICE 'Column updated_at added to delivery_assignments';
                END IF;
            END $$;
        `);

        console.log('--- DB Schema Fixes Completed Successfully ---');
    } catch (err) {
        console.error('❌ Error applying DB fixes:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runFixes();
