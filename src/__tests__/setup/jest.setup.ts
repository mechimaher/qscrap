/**
 * Enhanced Jest Setup File
 * Global test setup, mocks, and utilities
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-min-32-chars';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'password';
process.env.DB_NAME = process.env.DB_NAME || 'qscrap_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

// ============================================
// Global Mocks
// ============================================

// Mock Redis
jest.mock('../config/redis', () => {
    const mockRedisClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        expire: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
        on: jest.fn(),
        publish: jest.fn(),
        subscribe: jest.fn()
    };

    return {
        initializeRedis: jest.fn().mockResolvedValue(mockRedisClient),
        closeRedis: jest.fn().mockResolvedValue(undefined),
        getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
        redisAdapter: jest.fn().mockResolvedValue({})
    };
});

// Mock BullMQ Job Queue
jest.mock('../config/jobQueue', () => {
    const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getJobs: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn()
    };

    const mockWorker = {
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
    };

    return {
        initializeJobQueues: jest.fn().mockResolvedValue(false),
        closeJobQueues: jest.fn().mockResolvedValue(undefined),
        createJobWorker: jest.fn().mockReturnValue(mockWorker),
        scheduleRecurringJob: jest.fn().mockResolvedValue(undefined),
        getJobQueue: jest.fn().mockReturnValue(mockQueue),
        getPaymentQueue: jest.fn().mockReturnValue(mockQueue),
        getNotificationQueue: jest.fn().mockReturnValue(mockQueue)
    };
});

// Mock Socket.IO
jest.mock('../utils/socketIO', () => ({
    initializeSocketIO: jest.fn(),
    getIO: jest.fn().mockReturnValue({
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: {
            sockets: new Map()
        }
    })
});

// Mock Sentry
jest.mock('../config/sentry', () => ({
    initializeSentry: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn()
}));

// Mock email service
jest.mock('../services/email.service', () => ({
    emailService: {
        sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        sendTemplate: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        verifyConnection: jest.fn().mockResolvedValue(true)
    }
}));

// Mock SMS service
jest.mock('../services/sms.service', () => ({
    smsService: {
        sendSMS: jest.fn().mockResolvedValue({ messageId: 'test-sms-id' }),
        verifyConnection: jest.fn().mockResolvedValue(true)
    }
}));

// Mock storage service
jest.mock('../services/storage.service', () => ({
    storageService: {
        uploadFile: jest.fn().mockResolvedValue({ url: 'https://test.storage/qscrap/test-file.jpg' }),
        deleteFile: jest.fn().mockResolvedValue(undefined),
        getFileUrl: jest.fn().mockResolvedValue('https://test.storage/qscrap/test-file.jpg')
    }
}));

// Mock VIN service
jest.mock('../services/vin.service', () => ({
    vinService: {
        decodeVIN: jest.fn().mockResolvedValue({
            make: 'Toyota',
            model: 'Camry',
            year: 2022,
            trim: 'LE',
            engine: '2.5L 4-Cylinder'
        }),
        extractVINFromPhoto: jest.fn().mockResolvedValue('1HGBH41JXMN109186')
    }
}));

// Mock OCR service
jest.mock('../services/ocr.service', () => ({
    ocrService: {
        extractTextFromImage: jest.fn().mockResolvedValue('Extracted text'),
        extractVIN: jest.fn().mockResolvedValue('1HGBH41JXMN109186')
    }
}));

// Mock payment service
jest.mock('../services/payment/payment.service', () => ({
    PaymentService: class MockPaymentService {
        async createPaymentIntent() {
            return { clientSecret: 'test-secret', id: 'pi_test123' };
        }
        async processPayment() {
            return { success: true, transactionId: 'txn_test123' };
        }
        async refundPayment() {
            return { success: true, refundId: 'ref_test123' };
        }
        async getPaymentStatus() {
            return { status: 'succeeded', amount: 100 };
        }
    }
}));

// Mock Stripe
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: jest.fn().mockResolvedValue({ client_secret: 'test-secret', id: 'pi_test123' }),
            retrieve: jest.fn().mockResolvedValue({ status: 'succeeded' })
        },
        refunds: {
            create: jest.fn().mockResolvedValue({ id: 'ref_test123' })
        },
        customers: {
            create: jest.fn().mockResolvedValue({ id: 'cus_test123' })
        },
        webhooks: {
            constructEvent: jest.fn().mockReturnValue({ type: 'payment_intent.succeeded' })
        }
    }));
});

// ============================================
// Global Test Hooks
// ============================================

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global beforeAll hook
beforeAll(() => {
    // Suppress console logs during tests (optional - comment out for debugging)
    // global.console = {
    //     ...console,
    //     log: jest.fn(),
    //     debug: jest.fn(),
    //     info: jest.fn(),
    //     warn: jest.fn(),
    //     error: jest.fn(),
    // };
});

// Global afterAll hook
afterAll(async () => {
    // Cleanup any global test state
    // This runs after all tests in the file
});

// ============================================
// Custom Jest Matchers
// ============================================

// Add custom matchers for common assertions
expect.extend({
    toBeValidUUID(received: string) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const pass = uuidRegex.test(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid UUID`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid UUID`,
                pass: false
            };
        }
    },

    toBeQatarPhone(received: string) {
        const qatarPhoneRegex = /^(\+?974)?[3-7]\d{7}$/;
        const pass = qatarPhoneRegex.test(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid Qatar phone number`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid Qatar phone number`,
                pass: false
            };
        }
    },

    toBeStandardError(received: { status: number; body: Record<string, unknown> }) {
        const isStatus = [400, 401, 403, 404, 500].includes(received.status);
        const hasError = received.body && 'error' in received.body;
        const pass = isStatus && hasError;

        if (pass) {
            return {
                message: () => `expected response not to be a standard error`,
                pass: true
            };
        } else {
            return {
                message: () => `expected response to be a standard error (status 400/401/403/404/500 with error property)`,
                pass: false
            };
        }
    },

    toBeStandardSuccess(received: { status: number; body: Record<string, unknown> }) {
        const isStatus = [200, 201, 204].includes(received.status);
        const noError = !received.body || !('error' in received.body);
        const pass = isStatus && noError;

        if (pass) {
            return {
                message: () => `expected response not to be a standard success`,
                pass: true
            };
        } else {
            return {
                message: () => `expected response to be a standard success (status 200/201/204 without error property)`,
                pass: false
            };
        }
    }
});

// ============================================
// Type Declarations for Custom Matchers
// ============================================

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidUUID(): R;
            toBeQatarPhone(): R;
            toBeStandardError(): R;
            toBeStandardSuccess(): R;
        }
    }
}

export {};
