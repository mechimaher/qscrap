/**
 * QScrap Mobile - API Configuration Tests
 * Validates all endpoint constants, dynamic URL generation, and production config
 */

import { API_BASE_URL, SOCKET_URL, API_ENDPOINTS, APP_NAME, APP_VERSION } from '../config/api';

describe('API Configuration', () => {
    describe('Base URLs', () => {
        it('should use production API base URL', () => {
            expect(API_BASE_URL).toBe('https://api.qscrap.qa/api');
        });

        it('should use production Socket URL', () => {
            expect(SOCKET_URL).toBe('https://api.qscrap.qa');
        });

        it('should have correct app metadata', () => {
            expect(APP_NAME).toBe('QScrap');
            expect(APP_VERSION).toBeDefined();
        });
    });

    describe('Static Endpoints', () => {
        it('should have auth endpoints', () => {
            expect(API_ENDPOINTS.LOGIN).toBe('/auth/login');
            expect(API_ENDPOINTS.REGISTER).toBe('/auth/register');
            expect(API_ENDPOINTS.DELETE_ACCOUNT).toBe('/auth/delete-account');
            expect(API_ENDPOINTS.DELETION_ELIGIBILITY).toBe('/auth/deletion-eligibility');
            expect(API_ENDPOINTS.CHANGE_PASSWORD).toBe('/auth/change-password');
        });

        it('should have request endpoints', () => {
            expect(API_ENDPOINTS.REQUESTS).toBe('/requests');
            expect(API_ENDPOINTS.MY_REQUESTS).toBe('/requests/my');
        });

        it('should have order endpoints', () => {
            expect(API_ENDPOINTS.MY_ORDERS).toBe('/orders/my');
        });

        it('should have dashboard endpoints', () => {
            expect(API_ENDPOINTS.STATS).toBe('/dashboard/customer/stats');
            expect(API_ENDPOINTS.PROFILE).toBe('/dashboard/profile');
            expect(API_ENDPOINTS.UPDATE_PROFILE).toBe('/dashboard/profile');
        });

        it('should have notification endpoints', () => {
            expect(API_ENDPOINTS.NOTIFICATIONS).toBe('/dashboard/notifications');
            expect(API_ENDPOINTS.NOTIFICATIONS_REGISTER).toBe('/notifications/register-token');
            expect(API_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ).toBe('/dashboard/notifications/read-all');
        });

        it('should have address endpoints', () => {
            expect(API_ENDPOINTS.ADDRESSES).toBe('/addresses');
        });

        it('should have delivery endpoints', () => {
            expect(API_ENDPOINTS.ZONES).toBe('/delivery/zones');
            expect(API_ENDPOINTS.CALCULATE_FEE).toBe('/delivery/calculate-fee');
        });

        it('should have support ticket endpoints', () => {
            expect(API_ENDPOINTS.TICKETS).toBe('/support/tickets');
        });

        it('should have chat endpoints', () => {
            expect(API_ENDPOINTS.MESSAGES).toBe('/chat/messages');
        });

        it('should have catalog endpoints', () => {
            expect(API_ENDPOINTS.CATALOG_SEARCH).toBe('/showcase/parts');
        });
    });

    describe('Dynamic Endpoints', () => {
        const testId = 'test-uuid-123';

        it('should generate correct request cancel URL', () => {
            expect(API_ENDPOINTS.CANCEL_REQUEST(testId)).toBe(`/requests/${testId}/cancel`);
        });

        it('should generate correct delete request URL', () => {
            expect(API_ENDPOINTS.DELETE_REQUEST(testId)).toBe(`/requests/${testId}`);
        });

        it('should generate correct bid rejection URL', () => {
            expect(API_ENDPOINTS.REJECT_BID(testId)).toBe(`/bids/${testId}/reject`);
        });

        it('should generate correct accept bid URL', () => {
            expect(API_ENDPOINTS.ACCEPT_BID(testId)).toBe(`/orders/accept-bid/${testId}`);
        });

        it('should generate correct confirm delivery URL', () => {
            expect(API_ENDPOINTS.CONFIRM_DELIVERY(testId)).toBe(`/orders/${testId}/confirm-delivery`);
        });

        it('should generate correct submit review URL', () => {
            expect(API_ENDPOINTS.SUBMIT_REVIEW(testId)).toBe(`/orders/${testId}/review`);
        });

        it('should generate correct cancel order URL using cancellations route', () => {
            expect(API_ENDPOINTS.CANCEL_ORDER(testId)).toBe(`/cancellations/orders/${testId}/cancel/customer`);
        });

        it('should generate correct counter-offer URLs', () => {
            expect(API_ENDPOINTS.COUNTER_OFFER(testId)).toBe(`/negotiations/bids/${testId}/counter-offer`);
            expect(API_ENDPOINTS.RESPOND_TO_COUNTER(testId)).toBe(`/negotiations/counter-offers/${testId}/customer-respond`);
            expect(API_ENDPOINTS.ACCEPT_LAST_OFFER(testId)).toBe(`/negotiations/bids/${testId}/accept-last-offer`);
            expect(API_ENDPOINTS.NEGOTIATION_HISTORY(testId)).toBe(`/negotiations/bids/${testId}/negotiations`);
        });

        it('should generate correct notification mark-read URL', () => {
            expect(API_ENDPOINTS.MARK_NOTIFICATION_READ(testId)).toBe(`/dashboard/notifications/${testId}/read`);
        });

        it('should generate correct support ticket URLs', () => {
            expect(API_ENDPOINTS.TICKET_DETAIL(testId)).toBe(`/support/tickets/${testId}`);
            expect(API_ENDPOINTS.TICKET_MESSAGES(testId)).toBe(`/support/tickets/${testId}/messages`);
        });

        it('should generate correct chat messages URL', () => {
            expect(API_ENDPOINTS.CHAT_MESSAGES(testId)).toBe(`/chat/messages/${testId}`);
        });
    });

    describe('Endpoint Uniqueness', () => {
        it('should have no duplicate static endpoints', () => {
            const staticEndpoints = Object.entries(API_ENDPOINTS)
                .filter(([, v]) => typeof v === 'string')
                .map(([, v]) => v);
            // UPDATE_PROFILE and PROFILE are intentionally the same endpoint
            const unique = new Set(staticEndpoints);
            // Allow PROFILE === UPDATE_PROFILE (same endpoint, different HTTP methods)
            expect(unique.size).toBeGreaterThanOrEqual(staticEndpoints.length - 1);
        });
    });
});
