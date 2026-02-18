
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'sammil_admin',
    password: 'sammil_secure_2026',
    database: 'qscrap_db'
});

async function addColumn() {
    const client = await pool.connect();
    try {
        console.log('Adding pod_photo_url column to orders table...');
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='pod_photo_url') THEN 
          ALTER TABLE orders ADD COLUMN pod_photo_url TEXT; 
          RAISE NOTICE 'Column pod_photo_url added';
        ELSE 
          RAISE NOTICE 'Column pod_photo_url already exists';
        END IF; 
      END $$;
    `);
        console.log('Done.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        client.release();
        pool.end();
    }
}

addColumn();
