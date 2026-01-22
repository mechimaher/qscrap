// Script to check data in tables before migration
// Run with: node scripts/check-table-data.js

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'qscrap_db'
});

async function checkTableData() {
    console.log('🔍 Checking table data before migration...\n');

    const tablesToCheck = [
        'insurance_companies',
        'insurance_claims',
        'moi_reports',
        'moi_accident_reports',
        'escrow_payments',
        'escrow_activity_log',
        'price_benchmarks',
        'service_definitions',
        'service_requests',
        'service_bids',
        'quick_service_requests'
    ];

    const results = [];

    for (const table of tablesToCheck) {
        try {
            const res = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = parseInt(res.rows[0].count);
            results.push({ table, count, exists: true });
            console.log(`✅ ${table}: ${count} rows`);
        } catch (err) {
            if (err.code === '42P01') { // Table doesn't exist
                results.push({ table, count: 0, exists: false });
                console.log(`⚪ ${table}: TABLE DOES NOT EXIST`);
            } else {
                results.push({ table, count: -1, exists: null, error: err.message });
                console.log(`❌ ${table}: ERROR - ${err.message}`);
            }
        }
    }

    console.log('\n📊 Summary:');
    console.log('====================');

    const withData = results.filter(r => r.exists && r.count > 0);
    const empty = results.filter(r => r.exists && r.count === 0);
    const missing = results.filter(r => r.exists === false);

    console.log(`Tables with data: ${withData.length}`);
    withData.forEach(r => console.log(`  ⚠️  ${r.table}: ${r.count} rows - REQUIRES CONFIRMATION`));

    console.log(`\nEmpty tables: ${empty.length}`);
    empty.forEach(r => console.log(`  ✅ ${r.table}: 0 rows - SAFE TO DROP`));

    console.log(`\nMissing tables: ${missing.length}`);
    missing.forEach(r => console.log(`  ⚪ ${r.table}: Already removed`));

    await pool.end();

    if (withData.length > 0) {
        console.log('\n⚠️  WARNING: Some tables contain data. Please confirm before proceeding.');
        process.exit(1);
    } else {
        console.log('\n✅ All tables are empty or don\'t exist. Safe to proceed with migration.');
        process.exit(0);
    }
}

checkTableData().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
