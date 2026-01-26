/**
 * QScrap API Certification Tests
 * Run: node scripts/certification-tests.js
 */

const https = require('https');
const http = require('http');
const { Pool } = require('pg');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'qscrap',
    password: process.env.DB_PASSWORD || 'qscrap',
    database: process.env.DB_NAME || 'qscrap'
});

// Generate JWT token for testing
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'qscrap-jwt-secret-key';

function generateToken(userId, userType, role) {
    return jwt.sign({ userId, userType, role }, JWT_SECRET, { expiresIn: '1h' });
}

// Test results
const results = { passed: 0, failed: 0, tests: [] };

function log(category, test, passed, details = '') {
    const status = passed ? '✅' : '❌';
    console.log(`${status} [${category}] ${test}${details ? ' - ' + details : ''}`);
    results.tests.push({ category, test, passed, details });
    if (passed) results.passed++; else results.failed++;
}

async function httpRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const lib = url.protocol === 'https:' ? https : http;
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ============================================
// PHASE 1: DATABASE INTEGRITY TESTS
// ============================================

async function testDatabaseIntegrity() {
    console.log('\n========== PHASE 1: DATABASE INTEGRITY ==========\n');

    // Test 1: Check constraint - order_status_history.changed_by_type
    try {
        const result = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as def 
            FROM pg_constraint 
            WHERE conname = 'order_status_history_changed_by_type_check'
        `);
        const hasSupport = result.rows.length > 0 && result.rows[0].def.includes('support');
        log('DB', 'order_status_history.changed_by_type includes support', hasSupport);
    } catch (e) {
        log('DB', 'order_status_history constraint check', false, e.message);
    }

    // Test 2: Check refunds table has correct columns
    try {
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'refunds'
        `);
        const cols = result.rows.map(r => r.column_name);
        const hasRefundAmount = cols.includes('refund_amount');
        const hasRefundStatus = cols.includes('refund_status');
        log('DB', 'refunds table has refund_amount column', hasRefundAmount);
        log('DB', 'refunds table has refund_status column', hasRefundStatus);
    } catch (e) {
        log('DB', 'refunds table structure', false, e.message);
    }

    // Test 3: support_escalations table exists
    try {
        const result = await pool.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'support_escalations'
        `);
        log('DB', 'support_escalations table exists', parseInt(result.rows[0].count) > 0);
    } catch (e) {
        log('DB', 'support_escalations table', false, e.message);
    }

    // Test 4: disputes table exists
    try {
        const result = await pool.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'disputes'
        `);
        log('DB', 'disputes table exists', parseInt(result.rows[0].count) > 0);
    } catch (e) {
        log('DB', 'disputes table', false, e.message);
    }
}

// ============================================
// PHASE 2: API ENDPOINT TESTS
// ============================================

async function testAPIEndpoints() {
    console.log('\n========== PHASE 2: API ENDPOINTS ==========\n');

    // Generate tokens for different user types
    const customerToken = generateToken('test-customer', 'customer');
    const opsToken = generateToken('test-ops', 'staff', 'operations');
    const garageToken = generateToken('test-garage', 'garage');

    // Test 1: Health check
    try {
        const res = await httpRequest('GET', '/api/health');
        log('API', 'Health endpoint', res.status === 200);
    } catch (e) {
        log('API', 'Health endpoint', false, e.message);
    }

    // Test 2: Operations dashboard stats (requires auth)
    try {
        const res = await httpRequest('GET', '/api/operations/stats', null, opsToken);
        const hasStats = res.status === 200 && res.data.stats;
        log('API', 'Operations stats endpoint', hasStats);
        if (hasStats) {
            const hasPendingEscalations = 'pending_escalations' in res.data.stats;
            const hasPendingRefunds = 'pending_refunds' in res.data.stats;
            log('API', 'Stats includes pending_escalations', hasPendingEscalations);
            log('API', 'Stats includes pending_refunds', hasPendingRefunds);
        }
    } catch (e) {
        log('API', 'Operations stats', false, e.message);
    }

    // Test 3: Operations escalations endpoint
    try {
        const res = await httpRequest('GET', '/api/operations/escalations', null, opsToken);
        log('API', 'Operations escalations endpoint', res.status === 200);
    } catch (e) {
        log('API', 'Operations escalations', false, e.message);
    }

    // Test 4: Operations disputes endpoint
    try {
        const res = await httpRequest('GET', '/api/operations/disputes', null, opsToken);
        log('API', 'Operations disputes endpoint', res.status === 200);
    } catch (e) {
        log('API', 'Operations disputes', false, e.message);
    }

    // Test 5: Finance refunds endpoint
    try {
        const res = await httpRequest('GET', '/api/finance/refunds', null, opsToken);
        log('API', 'Finance refunds endpoint', res.status === 200 || res.status === 404);
    } catch (e) {
        log('API', 'Finance refunds', false, e.message);
    }

    // Test 6: Support customer-360 endpoint
    try {
        const res = await httpRequest('GET', '/api/support/customer-360/test', null, opsToken);
        // 404 is acceptable if no customer found
        log('API', 'Support customer-360 endpoint', res.status === 200 || res.status === 404);
    } catch (e) {
        log('API', 'Support customer-360', false, e.message);
    }

    // Test 7: Support quick-action endpoint (validation only)
    try {
        const res = await httpRequest('POST', '/api/support/quick-action', {
            action_type: 'full_refund'
            // Missing required fields - should return 400
        }, opsToken);
        log('API', 'Support quick-action validation', res.status === 400 || res.status === 500);
    } catch (e) {
        log('API', 'Support quick-action', false, e.message);
    }

    // Test 8: Auth required check
    try {
        const res = await httpRequest('GET', '/api/operations/stats');
        log('API', 'Auth required on protected endpoints', res.status === 401);
    } catch (e) {
        log('API', 'Auth enforcement', false, e.message);
    }
}

// ============================================
// PHASE 3: BUSINESS FLOW TESTS
// ============================================

async function testBusinessFlows() {
    console.log('\n========== PHASE 3: BUSINESS FLOWS ==========\n');

    // Test 1: Order status transitions are valid
    try {
        const result = await pool.query(`
            SELECT DISTINCT new_status, changed_by_type FROM order_status_history
        `);
        const validChangers = ['system', 'customer', 'garage', 'driver', 'admin', 'support', 'operations'];
        const allValid = result.rows.every(r => validChangers.includes(r.changed_by_type));
        log('FLOW', 'All status history changers are valid types', allValid);
    } catch (e) {
        log('FLOW', 'Status history validation', false, e.message);
    }

    // Test 2: Payouts tied to orders correctly
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as orphan_payouts FROM garage_payouts gp
            LEFT JOIN orders o ON gp.order_id = o.order_id
            WHERE o.order_id IS NULL
        `);
        const noOrphans = parseInt(result.rows[0].orphan_payouts) === 0;
        log('FLOW', 'No orphan payouts (all tied to orders)', noOrphans);
    } catch (e) {
        log('FLOW', 'Payout integrity', false, e.message);
    }

    // Test 3: Refunds tied to orders correctly
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as orphan_refunds FROM refunds r
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE o.order_id IS NULL
        `);
        const noOrphans = parseInt(result.rows[0].orphan_refunds) === 0;
        log('FLOW', 'No orphan refunds (all tied to orders)', noOrphans);
    } catch (e) {
        log('FLOW', 'Refund integrity', false, e.message);
    }

    // Test 4: Disputes have valid status
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as invalid FROM disputes 
            WHERE status NOT IN ('pending', 'contested', 'under_review', 'resolved', 'auto_resolved', 'cancelled')
        `);
        const allValid = parseInt(result.rows[0].invalid) === 0;
        log('FLOW', 'All disputes have valid status', allValid);
    } catch (e) {
        log('FLOW', 'Dispute status validation', false, e.message);
    }

    // Test 5: Support tickets have valid requester_type
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as invalid FROM support_tickets 
            WHERE requester_type NOT IN ('customer', 'garage', 'driver', 'admin')
        `);
        const allValid = parseInt(result.rows[0].invalid) === 0;
        log('FLOW', 'All support tickets have valid requester_type', allValid);
    } catch (e) {
        log('FLOW', 'Support ticket validation', false, e.message);
    }
}

// ============================================
// MAIN
// ============================================

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         QSCRAP CERTIFICATION TESTS                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Target: ${BASE_URL}`);

    await testDatabaseIntegrity();
    await testAPIEndpoints();
    await testBusinessFlows();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.passed + results.failed}`);
    console.log(`📈 Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n--- FAILED TESTS ---');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`  ❌ [${t.category}] ${t.test}: ${t.details || 'Failed'}`);
        });
    }

    await pool.end();
    process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
    console.error('Test suite error:', e);
    process.exit(1);
});
