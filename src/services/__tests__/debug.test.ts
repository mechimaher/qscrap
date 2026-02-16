
import pool from '../../config/db';

describe('CI Environment Debug', () => {
    it('should dump database state', async () => {
        console.log('--- CI DATABASE DEBUG DUMP ---');

        // Subscription Plans
        const plans = await pool.query('SELECT plan_code, plan_id, monthly_price_qar FROM subscription_plans');
        console.log('Subscription Plans:', JSON.stringify(plans.rows, null, 2));

        // Migrations
        const migrations = await pool.query('SELECT name, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 10');
        console.log('Recent Migrations:', JSON.stringify(migrations.rows, null, 2));

        // Users count
        const users = await pool.query('SELECT COUNT(*) FROM users');
        console.log('Users Count:', users.rows[0].count);

        // Env vars (careful with secrets)
        console.log('DB Host:', process.env.DB_HOST);
        console.log('DB Name:', process.env.DB_NAME);

        console.log('--- END DEBUG DUMP ---');
    });
});
