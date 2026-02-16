
import pool from '../../config/db';

describe('CI Environment Debug', () => {
    it('should dump database state via error message', async () => {
        const plans = await pool.query('SELECT plan_code, plan_id FROM subscription_plans');
        const migrations = await pool.query('SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 5');
        const users = await pool.query('SELECT COUNT(*) FROM users');

        const debugInfo = {
            plans: plans.rows,
            migrations: migrations.rows,
            usersCount: users.rows[0].count,
            env: {
                DB_HOST: process.env.DB_HOST,
                DB_NAME: process.env.DB_NAME
            }
        };

        throw new Error('CI_DEBUG_DUMP: ' + JSON.stringify(debugInfo, null, 2));
    });
});
