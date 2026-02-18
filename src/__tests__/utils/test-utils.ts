/**
 * Test Utilities for QScrap
 * Common helpers, factories, and utilities for testing
 */

import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/db';
import bcrypt from 'bcrypt';

// ============================================
// Test Data Factories
// ============================================

export interface TestUserOptions {
    userType?: 'customer' | 'garage' | 'driver' | 'admin' | 'staff';
    phonePrefix?: string;
    overrides?: Partial<TestUserData>;
}

export interface TestUserData {
    user_id: string;
    full_name: string;
    phone_number: string;
    email?: string;
    user_type: string;
    password_hash: string;
    is_active: boolean;
}

export interface TestGarageOptions {
    overrides?: Partial<TestGarageData>;
}

export interface TestGarageData {
    garage_id: string;
    user_id: string;
    garage_name: string;
    approval_status: string;
    location_lat: number;
    location_lng: number;
}

export interface TestPartRequestOptions {
    customerId?: string;
    overrides?: Partial<TestPartRequestData>;
}

export interface TestPartRequestData {
    request_id: string;
    customer_id: string;
    car_make: string;
    car_model: string;
    car_year: number;
    part_description: string;
    status: string;
}

export interface TestBidOptions {
    requestId?: string;
    garageId?: string;
    overrides?: Partial<TestBidData>;
}

export interface TestBidData {
    bid_id: string;
    request_id: string;
    garage_id: string;
    bid_amount: number;
    status: string;
    part_condition: string;
}

export interface TestOrderOptions {
    bidId?: string;
    customerId?: string;
    garageId?: string;
    overrides?: Partial<TestOrderData>;
}

export interface TestOrderData {
    order_id: string;
    order_number: string;
    bid_id: string;
    customer_id: string;
    garage_id: string;
    status: string;
    total_amount: number;
}

// ============================================
// ID Generators
// ============================================

/**
 * Generate a valid UUID for testing
 */
export const generateTestId = (): string => {
    return uuidv4();
};

/**
 * Generate a test phone number (Qatar format)
 */
export const generateTestPhone = (prefix: string = '3'): string => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
    return `+974${prefix}${randomDigits}`;
};

/**
 * Generate a test email
 */
export const generateTestEmail = (prefix: string = 'test'): string => {
    return `${prefix}.${Date.now()}@test.qscrap.qa`;
};

// ============================================
// Database Cleanup Utilities
// ============================================

/**
 * Clean up test data in correct order (respecting foreign keys)
 */
export const cleanupTestData = async (identifiers: {
    orderIds?: string[];
    bidIds?: string[];
    requestIds?: string[];
    garageIds?: string[];
    userIds?: string[];
    payoutIds?: string[];
    transactionIds?: string[];
}): Promise<void> => {
    const {
        orderIds = [],
        bidIds = [],
        requestIds = [],
        garageIds = [],
        userIds = [],
        payoutIds = [],
        transactionIds = []
    } = identifiers;

    try {
        // Delete in reverse dependency order
        if (payoutIds.length > 0) {
            await pool.query(
                'DELETE FROM garage_payouts WHERE payout_id = ANY($1)',
                [payoutIds]
            );
        }

        if (transactionIds.length > 0) {
            await pool.query(
                'DELETE FROM reward_transactions WHERE transaction_id = ANY($1)',
                [transactionIds]
            );
        }

        if (orderIds.length > 0) {
            await pool.query(
                'DELETE FROM support_tickets WHERE order_id = ANY($1)',
                [orderIds]
            );
            // Attempt to delete payment_intents if table exists (swallow error if not)
            try {
                await pool.query(
                    'DELETE FROM payment_intents WHERE order_id = ANY($1)',
                    [orderIds]
                );
            } catch (error) {
                // Ignore if table doesn't exist or other cleanup errors
            }

            await pool.query(
                'DELETE FROM order_status_history WHERE order_id = ANY($1)',
                [orderIds]
            );
            await pool.query(
                'DELETE FROM orders WHERE order_id = ANY($1)',
                [orderIds]
            );
        }

        if (bidIds.length > 0) {
            await pool.query(
                'DELETE FROM bids WHERE bid_id = ANY($1)',
                [bidIds]
            );
        }

        if (requestIds.length > 0) {
            await pool.query(
                'DELETE FROM part_requests WHERE request_id = ANY($1)',
                [requestIds]
            );
        }

        if (garageIds.length > 0) {
            await pool.query(
                'DELETE FROM garage_subscriptions WHERE garage_id = ANY($1)',
                [garageIds]
            );
            await pool.query(
                'DELETE FROM garages WHERE garage_id = ANY($1)',
                [garageIds]
            );
        }

        if (userIds.length > 0) {
            await pool.query(
                'DELETE FROM users WHERE user_id = ANY($1)',
                [userIds]
            );
        }
    } catch (error) {
        console.error('Cleanup error:', error);
        // Don't fail tests on cleanup errors
    }
};

/**
 * Clean up all test data with a specific pattern
 */
export const cleanupTestPattern = async (pattern: string): Promise<void> => {
    try {
        // Clean up users with test phone pattern
        await pool.query(
            "DELETE FROM users WHERE phone_number LIKE '+974999%'"
        );
        await pool.query(
            "DELETE FROM users WHERE email LIKE '%@test.qscrap.qa'"
        );
    } catch (error) {
        console.error('Pattern cleanup error:', error);
    }
};

// ============================================
// Data Factories
// ============================================

/**
 * Create test user data
 */
export const createTestUserData = (options: TestUserOptions = {}): TestUserData => {
    const {
        userType = 'customer',
        phonePrefix = '3',
        overrides = {}
    } = options;

    const userId = generateTestId();
    const phone = generateTestPhone(phonePrefix);

    return {
        user_id: userId,
        full_name: `Test ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
        phone_number: phone,
        email: generateTestEmail(`test.${userType}`),
        user_type: userType,
        password_hash: '$2b$10$dummyhashfortesting123456789012345', // Pre-hashed for inserts
        is_active: true,
        ...overrides
    };
};

/**
 * Create test garage data
 */
export const createTestGarageData = (
    userId: string,
    options: TestGarageOptions = {}
): TestGarageData => {
    const { overrides = {} } = options;

    return {
        garage_id: generateTestId(),
        user_id: userId,
        garage_name: `Test Garage ${Date.now()}`,
        approval_status: 'approved',
        location_lat: 25.276987 + (Math.random() - 0.5) * 0.1,
        location_lng: 51.520008 + (Math.random() - 0.5) * 0.1,
        ...overrides
    };
};

/**
 * Create test part request data
 */
export const createTestPartRequestData = (
    customerId: string,
    options: TestPartRequestOptions = {}
): TestPartRequestData => {
    const { overrides = {} } = options;

    return {
        request_id: generateTestId(),
        customer_id: customerId,
        car_make: 'Toyota',
        car_model: 'Camry',
        car_year: 2022,
        part_description: 'Test Part Request',
        status: 'active',
        ...overrides
    };
};

/**
 * Create test bid data
 */
export const createTestBidData = (
    requestId: string,
    garageId: string,
    options: TestBidOptions = {}
): TestBidData => {
    const { overrides = {} } = options;

    return {
        bid_id: generateTestId(),
        request_id: requestId,
        garage_id: garageId,
        bid_amount: 150.00,
        status: 'pending',
        part_condition: 'new',
        ...overrides
    };
};

/**
 * Create test order data
 */
export const createTestOrderData = (
    bidId: string,
    customerId: string,
    garageId: string,
    options: TestOrderOptions = {}
): TestOrderData => {
    const { overrides = {} } = options;

    return {
        order_id: generateTestId(),
        order_number: `ORD-${Date.now()}`,
        bid_id: bidId,
        customer_id: customerId,
        garage_id: garageId,
        status: 'pending',
        total_amount: 175.00,
        ...overrides
    };
};

// ============================================
// Database Helpers
// ============================================

/**
 * Insert a test user into the database
 */
export const insertTestUser = async (
    userData: Partial<TestUserData> & { phone_number: string }
): Promise<string> => {
    const user = {
        user_id: generateTestId(),
        full_name: 'Test User',
        phone_number: userData.phone_number,
        email: userData.email,
        user_type: userData.user_type || 'customer',
        password_hash: userData.password_hash || await bcrypt.hash('TestPass123!', 10),
        is_active: userData.is_active ?? true,
        ...userData
    };

    await pool.query(
        `INSERT INTO users (user_id, full_name, phone_number, email, user_type, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.user_id, user.full_name, user.phone_number, user.email, user.user_type, user.password_hash, user.is_active]
    );

    return user.user_id;
};

/**
 * Insert a test garage into the database
 */
export const insertTestGarage = async (
    garageData: Partial<TestGarageData> & { user_id: string }
): Promise<string> => {
    const garage = {
        garage_id: generateTestId(),
        user_id: garageData.user_id,
        garage_name: garageData.garage_name || 'Test Garage',
        approval_status: garageData.approval_status || 'approved',
        location_lat: garageData.location_lat ?? 25.276987,
        location_lng: garageData.location_lng ?? 51.520008,
        ...garageData
    };

    await pool.query(
        `INSERT INTO garages (garage_id, user_id, garage_name, approval_status, location_lat, location_lng)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (garage_id) DO NOTHING`,
        [garage.garage_id, garage.user_id, garage.garage_name, garage.approval_status, garage.location_lat, garage.location_lng]
    );

    return garage.garage_id;
};

/**
 * Insert a test part request into the database
 */
export const insertTestPartRequest = async (
    requestData: Partial<TestPartRequestData> & { customer_id: string }
): Promise<string> => {
    const request = {
        request_id: generateTestId(),
        customer_id: requestData.customer_id,
        car_make: requestData.car_make || 'Toyota',
        car_model: requestData.car_model || 'Camry',
        car_year: requestData.car_year || 2022,
        part_description: requestData.part_description || 'Test Part',
        status: requestData.status || 'active',
        ...requestData
    };

    await pool.query(
        `INSERT INTO part_requests (request_id, customer_id, car_make, car_model, car_year, part_description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (request_id) DO NOTHING`,
        [request.request_id, request.customer_id, request.car_make, request.car_model, request.car_year, request.part_description, request.status]
    );

    return request.request_id;
};

/**
 * Insert a test bid into the database
 */
export const insertTestBid = async (
    bidData: Partial<TestBidData> & { request_id: string; garage_id: string }
): Promise<string> => {
    const bid = {
        bid_id: generateTestId(),
        request_id: bidData.request_id,
        garage_id: bidData.garage_id,
        bid_amount: bidData.bid_amount || 150.00,
        status: bidData.status || 'pending',
        part_condition: bidData.part_condition || 'new',
        ...bidData
    };

    await pool.query(
        `INSERT INTO bids (bid_id, request_id, garage_id, bid_amount, status, part_condition)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (bid_id) DO NOTHING`,
        [bid.bid_id, bid.request_id, bid.garage_id, bid.bid_amount, bid.status, bid.part_condition]
    );

    return bid.bid_id;
};

/**
 * Insert a test garage subscription (required for bidding)
 */
export const insertTestSubscription = async (
    garageId: string,
    planCode: string = 'starter'
): Promise<void> => {
    await pool.query(
        `INSERT INTO garage_subscriptions (garage_id, plan_id, status, billing_cycle_start, billing_cycle_end)
         VALUES ($1, (SELECT plan_id FROM subscription_plans WHERE plan_code = $2 LIMIT 1), 'active', NOW(), NOW() + INTERVAL '30 days')
         ON CONFLICT (garage_id, plan_id) DO UPDATE SET status = 'active'`,
        [garageId, planCode]
    );
};

// ============================================
// Authentication Helpers
// ============================================

/**
 * Create a mock JWT token for testing
 */
export const createMockToken = (payload: {
    userId: string;
    userType: string;
    garageId?: string;
    staffRole?: string;
}): string => {
    // Simple mock token (not cryptographically valid, but works for unit tests)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify({
        userId: payload.userId,
        userType: payload.userType,
        garageId: payload.garageId,
        staffRole: payload.staffRole,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64');
    const signature = Buffer.from('mock-signature').toString('base64');

    return `${header}.${body}.${signature}`;
};

/**
 * Create authentication headers for supertest
 */
export const createAuthHeaders = (token: string): Record<string, string> => {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that a response has a valid JWT token structure
 */
export const expectValidToken = (token: string): void => {
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
    expect(token.length).toBeGreaterThan(50);
};

/**
 * Assert that a response matches standard error format
 */
export const expectStandardError = (response: { status: number; body: Record<string, unknown> }): void => {
    expect([400, 401, 403, 404, 500]).toContain(response.status);
    expect(response.body).toHaveProperty('error');
};

/**
 * Assert that a response matches standard success format
 */
export const expectStandardSuccess = (response: { status: number; body: Record<string, unknown> }): void => {
    expect([200, 201, 204]).toContain(response.status);
    expect(response.body).not.toHaveProperty('error');
};

// ============================================
// Time Helpers
// ============================================

/**
 * Wait for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Get a timestamp from N minutes ago
 */
export const minutesAgo = (minutes: number): Date => {
    return new Date(Date.now() - minutes * 60 * 1000);
};

/**
 * Get a timestamp from N hours ago
 */
export const hoursAgo = (hours: number): Date => {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
};

/**
 * Get a timestamp from N days ago
 */
export const daysAgo = (days: number): Date => {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};
