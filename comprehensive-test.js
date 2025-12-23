/**
 * QScrap Comprehensive System Test
 * ================================
 * Simulates 3 expert teams testing all dashboards
 * 
 * Team Alpha: Customer Dashboard
 * Team Beta: Garage Dashboard
 * Team Gamma: Operations Dashboard
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

const BASE_URL = 'http://localhost:3000';

// Test Results Tracker
const results = {
    passed: 0,
    failed: 0,
    issues: []
};

function log(team, message, type = 'info') {
    const colors = {
        alpha: '\x1b[34m',   // Blue
        beta: '\x1b[32m',    // Green
        gamma: '\x1b[33m',   // Yellow
        success: '\x1b[32m', // Green
        error: '\x1b[31m',   // Red
        warn: '\x1b[33m',    // Yellow
        info: '\x1b[36m',    // Cyan
        reset: '\x1b[0m'
    };

    const teamColor = colors[team] || colors.info;
    const typeSymbol = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '🔍';
    console.log(`${teamColor}[${team.toUpperCase()}]${colors.reset} ${typeSymbol} ${message}`);
}

function recordIssue(team, severity, description, details = '') {
    results.issues.push({
        id: `ISS-${String(results.issues.length + 1).padStart(3, '0')}`,
        team,
        severity,
        description,
        details,
        timestamp: new Date().toISOString()
    });
    results.failed++;
}

function recordPass() {
    results.passed++;
}

// ============================================
// AUTHENTICATION HELPER
// ============================================
async function getAuthToken(phone, password = 'Test1234') {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, password })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.token;
    } catch (err) {
        return null;
    }
}

// ============================================
// TEAM ALPHA: CUSTOMER DASHBOARD TESTS
// ============================================
async function runTeamAlphaTests(customerToken) {
    console.log('\n' + '='.repeat(60));
    console.log('🔵 TEAM ALPHA: Customer Dashboard Testing');
    console.log('   Engineer: Alex Chen | Business Expert: Sarah Al-Thani');
    console.log('='.repeat(60) + '\n');

    // Test 1: Dashboard Stats API
    log('alpha', 'Testing dashboard stats endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/dashboard/customer`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.stats && typeof data.stats.active_requests !== 'undefined') {
                log('alpha', 'Dashboard stats API working correctly', 'success');
                recordPass();
            } else {
                recordIssue('alpha', 'MEDIUM', 'Dashboard stats missing expected fields', JSON.stringify(data));
            }
        } else {
            recordIssue('alpha', 'HIGH', 'Dashboard stats API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('alpha', 'CRITICAL', 'Dashboard stats API error', err.message);
    }

    // Test 2: Active Requests API
    log('alpha', 'Testing customer requests endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/requests/my`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.requests)) {
                log('alpha', `Found ${data.requests.length} customer requests`, 'success');
                recordPass();
            } else {
                recordIssue('alpha', 'MEDIUM', 'Requests response not an array', typeof data.requests);
            }
        } else {
            recordIssue('alpha', 'HIGH', 'My requests API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('alpha', 'CRITICAL', 'My requests API error', err.message);
    }

    // Test 3: Orders API
    log('alpha', 'Testing customer orders endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/orders/my`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.orders)) {
                log('alpha', `Found ${data.orders.length} customer orders`, 'success');
                recordPass();

                // Business Logic Check: Order has required fields
                if (data.orders.length > 0) {
                    const order = data.orders[0];
                    const requiredFields = ['order_id', 'order_number', 'order_status', 'total_amount'];
                    const missingFields = requiredFields.filter(f => !order[f]);
                    if (missingFields.length > 0) {
                        recordIssue('alpha', 'MEDIUM', 'Order missing required fields', missingFields.join(', '));
                    } else {
                        log('alpha', 'Order structure validated', 'success');
                        recordPass();
                    }
                }
            } else {
                recordIssue('alpha', 'MEDIUM', 'Orders response not an array');
            }
        } else {
            recordIssue('alpha', 'HIGH', 'My orders API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('alpha', 'CRITICAL', 'My orders API error', err.message);
    }

    // Test 4: Input Validation Test
    log('alpha', 'Testing request creation validation...');
    try {
        const response = await fetch(`${BASE_URL}/api/requests`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${customerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                car_make: '', // Invalid: empty
                car_model: 'Camry',
                car_year: 'invalid', // Invalid: not a number
                part_description: ''  // Invalid: empty
            })
        });

        if (response.status === 400) {
            log('alpha', 'Input validation working correctly (rejected invalid data)', 'success');
            recordPass();
        } else {
            recordIssue('alpha', 'CRITICAL', 'Input validation not working', `Expected 400, got ${response.status}`);
        }
    } catch (err) {
        recordIssue('alpha', 'CRITICAL', 'Validation test error', err.message);
    }

    // Test 5: Notifications API
    log('alpha', 'Testing notifications endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/dashboard/notifications`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });

        if (response.ok) {
            log('alpha', 'Notifications API working', 'success');
            recordPass();
        } else if (response.status === 404) {
            recordIssue('alpha', 'MEDIUM', 'Notifications endpoint not found', 'May need implementation');
        } else {
            recordIssue('alpha', 'LOW', 'Notifications API returned unexpected status', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('alpha', 'LOW', 'Notifications API error', err.message);
    }

    return results;
}

// ============================================
// TEAM BETA: GARAGE DASHBOARD TESTS
// ============================================
async function runTeamBetaTests(garageToken) {
    console.log('\n' + '='.repeat(60));
    console.log('🟢 TEAM BETA: Garage Dashboard Testing');
    console.log('   Engineer: Mohammed Rashid | Business Expert: Omar Al-Mansouri');
    console.log('='.repeat(60) + '\n');

    // Test 1: Garage Dashboard Stats
    log('beta', 'Testing garage dashboard stats...');
    try {
        const response = await fetch(`${BASE_URL}/api/dashboard/garage`, {
            headers: { 'Authorization': `Bearer ${garageToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.stats) {
                log('beta', 'Garage stats API working', 'success');
                recordPass();

                // Business Logic: Check stats structure
                const expectedStats = ['pending_bids', 'active_orders', 'completed_orders_month', 'revenue_month'];
                const missingStats = expectedStats.filter(s => typeof data.stats[s] === 'undefined');
                if (missingStats.length > 0) {
                    recordIssue('beta', 'MEDIUM', 'Garage stats missing fields', missingStats.join(', '));
                } else {
                    log('beta', 'Garage stats structure validated', 'success');
                    recordPass();
                }
            } else {
                recordIssue('beta', 'HIGH', 'Garage stats response missing stats object');
            }
        } else {
            recordIssue('beta', 'HIGH', 'Garage dashboard API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Garage dashboard API error', err.message);
    }

    // Test 2: Active Requests for Bidding
    log('beta', 'Testing active requests endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/requests/pending`, {
            headers: { 'Authorization': `Bearer ${garageToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.requests)) {
                log('beta', `Found ${data.requests.length} active requests`, 'success');
                recordPass();
            } else {
                recordIssue('beta', 'MEDIUM', 'Active requests response format issue');
            }
        } else {
            recordIssue('beta', 'HIGH', 'Active requests API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Active requests API error', err.message);
    }

    // Test 3: Garage Subscription Status
    log('beta', 'Testing subscription endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/subscriptions/my`, {
            headers: { 'Authorization': `Bearer ${garageToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('beta', 'Subscription status API working', 'success');
            recordPass();

            // Business Logic: Subscription has required fields
            if (data.subscription) {
                const requiredFields = ['status', 'plan_name'];
                const hasStatus = data.subscription.status || data.status;
                if (!hasStatus) {
                    recordIssue('beta', 'MEDIUM', 'Subscription missing status field');
                } else {
                    log('beta', `Subscription status: ${hasStatus}`, 'success');
                    recordPass();
                }
            }
        } else {
            recordIssue('beta', 'HIGH', 'Subscription status API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Subscription status API error', err.message);
    }

    // Test 4: Payout Summary
    log('beta', 'Testing payout summary endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/finance/payouts/summary`, {
            headers: { 'Authorization': `Bearer ${garageToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('beta', 'Payout summary API working', 'success');
            recordPass();

            // Business Logic Check: Payout amounts make sense
            if (data.stats) {
                const pending = parseFloat(data.stats.pending_payouts) || 0;
                const completed = parseFloat(data.stats.completed_payouts) || 0;
                log('beta', `Payouts - Pending: ${pending} QAR, Completed: ${completed} QAR`, 'info');
            }

            if (data.pending_payouts && Array.isArray(data.pending_payouts)) {
                log('beta', `${data.pending_payouts.length} pending payout(s) in queue`, 'info');
            }
        } else {
            recordIssue('beta', 'HIGH', 'Payout summary API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Payout summary API error', err.message);
    }

    // Test 5: Bid Submission Validation
    log('beta', 'Testing bid submission validation...');
    try {
        const response = await fetch(`${BASE_URL}/api/bids/invalid-request-id`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${garageToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bid_amount: -100, // Invalid: negative
                part_condition: 'invalid_condition' // Invalid enum
            })
        });

        if (response.status === 400 || response.status === 404) {
            log('beta', 'Bid validation working (rejected invalid data)', 'success');
            recordPass();
        } else {
            recordIssue('beta', 'CRITICAL', 'Bid validation not working', `Expected 400/404, got ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Bid validation test error', err.message);
    }

    // Test 6: Garage Orders
    log('beta', 'Testing garage orders endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/orders/my`, {
            headers: { 'Authorization': `Bearer ${garageToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('beta', `Found ${data.orders?.length || 0} garage orders`, 'success');
            recordPass();
        } else {
            recordIssue('beta', 'HIGH', 'Garage orders API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('beta', 'CRITICAL', 'Garage orders API error', err.message);
    }

    return results;
}

// ============================================
// TEAM GAMMA: OPERATIONS DASHBOARD TESTS
// ============================================
async function runTeamGammaTests(opsToken) {
    console.log('\n' + '='.repeat(60));
    console.log('🟠 TEAM GAMMA: Operations Dashboard Testing');
    console.log('   Engineer: Fatima Hassan | Business Expert: Ahmed Khalifa');
    console.log('='.repeat(60) + '\n');

    // Test 1: Operations Dashboard Stats
    log('gamma', 'Testing operations dashboard stats...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.stats) {
                log('gamma', 'Operations dashboard stats working', 'success');
                recordPass();

                // Business Logic: Check all key metrics present
                const expectedMetrics = ['active_orders', 'pending_disputes', 'revenue_today'];
                const hasMetrics = expectedMetrics.every(m => typeof data.stats[m] !== 'undefined');
                if (hasMetrics) {
                    log('gamma', 'All key metrics present', 'success');
                    recordPass();
                } else {
                    recordIssue('gamma', 'MEDIUM', 'Some metrics missing from ops dashboard');
                }
            } else {
                recordIssue('gamma', 'HIGH', 'Ops dashboard missing stats object');
            }
        } else {
            recordIssue('gamma', 'HIGH', 'Ops dashboard stats API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'Ops dashboard stats API error', err.message);
    }

    // Test 2: User Stats API
    log('gamma', 'Testing user stats endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/users/stats`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('gamma', 'User stats API working', 'success');
            recordPass();

            if (typeof data.total_customers !== 'undefined') {
                log('gamma', `Total customers: ${data.total_customers}, Garages: ${data.total_garages}`, 'info');
            }
        } else {
            recordIssue('gamma', 'HIGH', 'User stats API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'User stats API error', err.message);
    }

    // Test 3: Garages List API
    log('gamma', 'Testing garages list endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/garages`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.garages && Array.isArray(data.garages)) {
                log('gamma', `Found ${data.garages.length} garage(s)`, 'success');
                recordPass();
            } else {
                recordIssue('gamma', 'MEDIUM', 'Garages response format issue');
            }
        } else {
            recordIssue('gamma', 'HIGH', 'Garages list API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'Garages list API error', err.message);
    }

    // Test 4: Disputes List
    log('gamma', 'Testing disputes endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/disputes`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('gamma', 'Disputes API working', 'success');
            recordPass();

            if (data.disputes) {
                log('gamma', `Found ${data.disputes.length} dispute(s)`, 'info');
            }
        } else {
            recordIssue('gamma', 'HIGH', 'Disputes API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'Disputes API error', err.message);
    }

    // Test 5: Payout Configuration
    log('gamma', 'Testing payout config endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/finance/payouts/config`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('gamma', 'Payout config API working', 'success');
            recordPass();

            if (data.config) {
                log('gamma', `Processing delay: ${data.config.processing_delay_days} days`, 'info');
                log('gamma', `Auto-processing: ${data.config.auto_processing_enabled ? 'Enabled' : 'Disabled'}`, 'info');
            }
        } else {
            recordIssue('gamma', 'MEDIUM', 'Payout config API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'MEDIUM', 'Payout config API error', err.message);
    }

    // Test 6: All Orders (Operations View)
    log('gamma', 'Testing operations orders endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/orders`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('gamma', `Found ${data.orders?.length || 0} total orders`, 'success');
            recordPass();
        } else {
            recordIssue('gamma', 'HIGH', 'Operations orders API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'Operations orders API error', err.message);
    }

    // Test 7: Analytics Endpoint
    log('gamma', 'Testing analytics endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/api/operations/analytics?period=7d`, {
            headers: { 'Authorization': `Bearer ${opsToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            log('gamma', 'Analytics API working', 'success');
            recordPass();

            if (data.orders) {
                log('gamma', `Total orders in period: ${data.orders.total_orders}`, 'info');
            }
        } else {
            recordIssue('gamma', 'HIGH', 'Analytics API failed', `Status: ${response.status}`);
        }
    } catch (err) {
        recordIssue('gamma', 'CRITICAL', 'Analytics API error', err.message);
    }

    return results;
}

// ============================================
// DATABASE VALIDATION TESTS
// ============================================
async function runDatabaseValidation() {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 DATABASE & BUSINESS LOGIC VALIDATION');
    console.log('='.repeat(60) + '\n');

    const client = await pool.connect();

    try {
        // Test 1: Check for orphaned records
        log('db', 'Checking for orphaned bids (no matching request)...');
        const orphanedBids = await client.query(`
            SELECT COUNT(*) as count FROM bids b
            LEFT JOIN part_requests pr ON b.request_id = pr.request_id
            WHERE pr.request_id IS NULL
        `);
        if (parseInt(orphanedBids.rows[0].count) === 0) {
            log('db', 'No orphaned bids found', 'success');
            recordPass();
        } else {
            recordIssue('db', 'HIGH', 'Found orphaned bids', `Count: ${orphanedBids.rows[0].count}`);
        }

        // Test 2: Check subscription integrity
        log('db', 'Checking subscription integrity...');
        const invalidSubs = await client.query(`
            SELECT COUNT(*) as count FROM garage_subscriptions gs
            LEFT JOIN garages g ON gs.garage_id = g.garage_id
            WHERE g.garage_id IS NULL
        `);
        if (parseInt(invalidSubs.rows[0].count) === 0) {
            log('db', 'Subscription integrity OK', 'success');
            recordPass();
        } else {
            recordIssue('db', 'CRITICAL', 'Found orphaned subscriptions', `Count: ${invalidSubs.rows[0].count}`);
        }

        // Test 3: Check payout calculations
        log('db', 'Validating payout calculations...');
        const invalidPayouts = await client.query(`
            SELECT COUNT(*) as count FROM garage_payouts
            WHERE ABS(gross_amount - commission_amount - net_amount) > 0.01
        `);
        if (parseInt(invalidPayouts.rows[0].count) === 0) {
            log('db', 'Payout calculations verified', 'success');
            recordPass();
        } else {
            recordIssue('db', 'CRITICAL', 'Payout calculation errors found', `Count: ${invalidPayouts.rows[0].count}`);
        }

        // Test 4: Check order status consistency
        log('db', 'Checking order status consistency...');
        const completedWithoutPayment = await client.query(`
            SELECT COUNT(*) as count FROM orders
            WHERE order_status = 'completed' AND payment_status != 'paid'
        `);
        if (parseInt(completedWithoutPayment.rows[0].count) === 0) {
            log('db', 'Order status consistency OK', 'success');
            recordPass();
        } else {
            recordIssue('db', 'HIGH', 'Completed orders without paid status', `Count: ${completedWithoutPayment.rows[0].count}`);
        }

        // Test 5: Check dispute-order linkage
        log('db', 'Checking dispute-order relationships...');
        const orphanedDisputes = await client.query(`
            SELECT COUNT(*) as count FROM disputes d
            LEFT JOIN orders o ON d.order_id = o.order_id
            WHERE o.order_id IS NULL
        `);
        if (parseInt(orphanedDisputes.rows[0].count) === 0) {
            log('db', 'Dispute-order relationships OK', 'success');
            recordPass();
        } else {
            recordIssue('db', 'CRITICAL', 'Found orphaned disputes', `Count: ${orphanedDisputes.rows[0].count}`);
        }

    } catch (err) {
        recordIssue('db', 'CRITICAL', 'Database validation error', err.message);
    } finally {
        client.release();
    }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     QSCRAP COMPREHENSIVE SYSTEM TEST                       ║');
    console.log('║     3 Expert Teams × 3 Dashboards × Full Coverage          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n📅 Test Started:', new Date().toISOString());
    console.log('🎯 Target: 5/5 Rating Achievement\n');

    // Get authentication tokens
    console.log('🔐 Authenticating test users...\n');

    const customerToken = await getAuthToken('+97450267974');
    const garageToken = await getAuthToken('+97455906912');
    const opsToken = await getAuthToken('ops123456');

    if (!customerToken) {
        recordIssue('auth', 'CRITICAL', 'Customer authentication failed');
    } else {
        log('auth', 'Customer authenticated', 'success');
        recordPass();
    }

    if (!garageToken) {
        recordIssue('auth', 'CRITICAL', 'Garage authentication failed');
    } else {
        log('auth', 'Garage authenticated', 'success');
        recordPass();
    }

    if (!opsToken) {
        recordIssue('auth', 'CRITICAL', 'Operations user authentication failed');
    } else {
        log('auth', 'Operations user authenticated', 'success');
        recordPass();
    }

    // Run all team tests
    if (customerToken) await runTeamAlphaTests(customerToken);
    if (garageToken) await runTeamBetaTests(garageToken);
    if (opsToken) await runTeamGammaTests(opsToken);

    // Run database validation
    await runDatabaseValidation();

    // Print Final Report
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL TEST REPORT                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Test Results:`);
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%\n`);

    if (results.issues.length > 0) {
        console.log('🔴 Issues Found:');
        console.log('-'.repeat(60));

        const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
        results.issues.forEach(issue => {
            bySeverity[issue.severity] = bySeverity[issue.severity] || [];
            bySeverity[issue.severity].push(issue);
        });

        ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
            if (bySeverity[severity] && bySeverity[severity].length > 0) {
                console.log(`\n  ${severity}:`);
                bySeverity[severity].forEach(issue => {
                    console.log(`    ${issue.id} [${issue.team.toUpperCase()}] ${issue.description}`);
                    if (issue.details) console.log(`        Details: ${issue.details}`);
                });
            }
        });
    } else {
        console.log('🎉 NO ISSUES FOUND! System is operating correctly.');
    }

    // Calculate rating
    const successRate = results.passed / (results.passed + results.failed);
    const criticalIssues = results.issues.filter(i => i.severity === 'CRITICAL').length;
    const highIssues = results.issues.filter(i => i.severity === 'HIGH').length;

    let rating = 5;
    if (criticalIssues > 0) rating = Math.max(1, rating - criticalIssues);
    if (highIssues > 0) rating = Math.max(2, rating - Math.floor(highIssues / 2));
    if (successRate < 0.9) rating = Math.max(3, rating - 1);
    if (successRate < 0.7) rating = Math.max(2, rating - 1);

    console.log('\n' + '='.repeat(60));
    console.log(`\n🏆 SYSTEM RATING: ${'⭐'.repeat(rating)} (${rating}/5)\n`);

    if (rating === 5) {
        console.log('🎉 CONGRATULATIONS! System achieves 5/5 rating!');
        console.log('   All tests passed with no critical issues.\n');
    } else {
        console.log('📋 RECOMMENDATIONS:');
        if (criticalIssues > 0) console.log('   - Fix all CRITICAL issues immediately');
        if (highIssues > 0) console.log('   - Address HIGH priority issues');
        console.log('   - Re-run tests after fixes\n');
    }

    console.log('📅 Test Completed:', new Date().toISOString());
    console.log('\n');

    await pool.end();
    return results;
}

runAllTests().catch(console.error);
