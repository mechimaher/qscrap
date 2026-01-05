// Process existing pending payouts that are older than 7 days
// Run this once to bring existing payouts up to date with the new auto-processing system

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

async function processExistingPayouts() {
    const client = await pool.connect();

    console.log('\n🔄 Processing Existing Pending Payouts\n');
    console.log('='.repeat(60));

    try {
        await client.query('BEGIN');

        // 1. First, update scheduled_for for payouts that don't have it set
        const updateScheduled = await client.query(`
            UPDATE garage_payouts
            SET scheduled_for = COALESCE(scheduled_for, created_at::date + INTERVAL '7 days')
            WHERE scheduled_for IS NULL AND payout_status = 'pending'
            RETURNING payout_id
        `);

        console.log(`📅 Updated ${updateScheduled.rowCount || 0} payouts with scheduled dates`);

        // 2. Process payouts that:
        //    - Are pending
        //    - Were created more than 7 days ago (or scheduled_for <= today)
        //    - Don't have active disputes
        const processResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'completed',
                payout_method = 'auto_transfer',
                payout_reference = 'AUTO-MIGRATION-' || payout_id::text,
                processed_at = NOW()
            WHERE gp.payout_status = 'pending'
              AND (gp.scheduled_for <= CURRENT_DATE OR gp.created_at < NOW() - INTERVAL '7 days')
              AND NOT EXISTS (
                  SELECT 1 FROM disputes d 
                  WHERE d.order_id = gp.order_id 
                  AND d.status IN ('pending', 'under_review', 'contested')
              )
            RETURNING gp.payout_id, gp.garage_id, gp.net_amount, gp.created_at
        `);

        const processedCount = processResult.rowCount || 0;

        if (processedCount > 0) {
            console.log(`\n✅ Auto-processed ${processedCount} payout(s):`);
            console.log('-'.repeat(60));

            for (const payout of processResult.rows) {
                console.log(`   💰 Payout ${payout.payout_id.slice(0, 8)}... | ${payout.net_amount} QAR | Created: ${new Date(payout.created_at).toLocaleDateString()}`);
            }
        } else {
            console.log('\n📭 No pending payouts ready for processing');
        }

        // 3. Check for payouts that should be held due to disputes
        const holdResult = await client.query(`
            UPDATE garage_payouts gp
            SET payout_status = 'on_hold',
                failure_reason = 'Order has active dispute - payout held pending resolution'
            FROM disputes d
            WHERE gp.order_id = d.order_id
              AND gp.payout_status = 'pending'
              AND d.status IN ('pending', 'under_review', 'contested')
            RETURNING gp.payout_id
        `);

        if ((holdResult.rowCount || 0) > 0) {
            console.log(`\n⚠️  Held ${holdResult.rowCount} payout(s) due to active disputes`);
        }

        // 4. Show remaining pending payouts
        const remainingResult = await client.query(`
            SELECT gp.payout_id, gp.net_amount, gp.scheduled_for, g.garage_name,
                   CASE 
                       WHEN gp.scheduled_for > CURRENT_DATE 
                       THEN gp.scheduled_for - CURRENT_DATE 
                       ELSE 0 
                   END as days_remaining
            FROM garage_payouts gp
            JOIN garages g ON gp.garage_id = g.garage_id
            WHERE gp.payout_status = 'pending'
            ORDER BY gp.scheduled_for ASC
        `);

        if (remainingResult.rows.length > 0) {
            console.log(`\n📋 Remaining pending payouts: ${remainingResult.rows.length}`);
            console.log('-'.repeat(60));

            for (const payout of remainingResult.rows) {
                console.log(`   🕐 ${payout.net_amount} QAR | ${payout.garage_name} | Processing in ${payout.days_remaining} days`);
            }
        }

        await client.query('COMMIT');

        // Final summary
        const summaryResult = await client.query(`
            SELECT payout_status, COUNT(*) as count, SUM(net_amount) as total
            FROM garage_payouts
            GROUP BY payout_status
            ORDER BY payout_status
        `);

        console.log('\n' + '='.repeat(60));
        console.log('📊 PAYOUT SUMMARY:');
        console.log('-'.repeat(60));

        for (const row of summaryResult.rows) {
            const status = row.payout_status.toUpperCase().padEnd(12);
            const count = String(row.count).padStart(4);
            const total = parseFloat(row.total || 0).toFixed(2);
            console.log(`   ${status}: ${count} payouts | ${total} QAR`);
        }

        console.log('\n✅ Migration complete!');
        console.log('💡 From now on, payouts will be auto-processed after 7-day waiting period.\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

processExistingPayouts();
