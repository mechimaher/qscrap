import pool from './src/config/db';
import fs from 'fs';
import path from 'path';

async function run() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'src/config/migrations/20251231_add_original_bid_amount.sql'), 'utf8');
        await pool.query(sql);
        console.log('Migration successful');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
