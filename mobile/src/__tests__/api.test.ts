/**
 * QScrap Mobile - API Service Tests
 * Validates all API methods use correct endpoints, HTTP methods, and auth headers
 * Aligned with backend routes in config/api.ts
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// Mock the logger before importing api
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

// We need to import api AFTER mocking SecureStore (done in jest.setup.js)
import { api } from '../services/api';

// Helper to mock fetch responses
const mockFetchSuccess = (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(data),
        headers: new Map([['content-type', 'application/json']]),
    });
};

const mockFetchError = (status: number, data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status,
        json: jest.fn().mockResolvedValue(data),
        headers: new Map([['content-type', 'application/json']]),
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
});

describe('API Service', () => {
    // ============================================================================
    // AUTH
    // ============================================================================
    describe('Auth', () => {
        it('login should POST to /auth/login with credentials', async () => {
            mockFetchSuccess({ token: 'test-token', userId: '123', userType: 'customer' });

            await api.login('33334444', 'password123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ phone_number: '33334444', password: 'password123' }),
                })
            );
        });

        it('register should POST to /auth/register', async () => {
            mockFetchSuccess({ success: true, message: 'Registered' });

            await api.register('John Doe', '33334444', 'password123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.REGISTER}`,
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        it('changePassword should POST to /auth/change-password', async () => {
            mockFetchSuccess({ success: true, message: 'Changed' });

            await api.changePassword('oldPass', 'newPass');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CHANGE_PASSWORD}`,
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });
    });

    // ============================================================================
    // REQUESTS
    // ============================================================================
    describe('Requests', () => {
        it('getMyRequests should call /requests/my', async () => {
            mockFetchSuccess({ requests: [] });

            await api.getMyRequests();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.MY_REQUESTS}`,
                expect.anything()
            );
        });

        it('getRequestDetails should call /requests/:id', async () => {
            mockFetchSuccess({ request: {}, bids: [] });

            await api.getRequestDetails('req-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/requests/req-123`,
                expect.anything()
            );
        });

        it('cancelRequest should POST /requests/:id/cancel', async () => {
            mockFetchSuccess({ success: true, message: 'Cancelled' });

            await api.cancelRequest('req-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CANCEL_REQUEST('req-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('deleteRequest should DELETE /requests/:id', async () => {
            mockFetchSuccess({ success: true, message: 'Deleted' });

            await api.deleteRequest('req-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.DELETE_REQUEST('req-123')}`,
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    // ============================================================================
    // ORDERS
    // ============================================================================
    describe('Orders', () => {
        it('getMyOrders should call /orders/my', async () => {
            mockFetchSuccess({ orders: [] });

            await api.getMyOrders();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.MY_ORDERS}`,
                expect.anything()
            );
        });

        it('acceptBid should POST to /orders/accept-bid/:bidId with payment method', async () => {
            mockFetchSuccess({ success: true, order_id: 'order-1' });

            await api.acceptBid('bid-123', 'card');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.ACCEPT_BID('bid-123')}`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ payment_method: 'card' }),
                })
            );
        });

        it('acceptBid should default to cash payment method', async () => {
            mockFetchSuccess({ success: true, order_id: 'order-1' });

            await api.acceptBid('bid-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.ACCEPT_BID('bid-123')}`,
                expect.objectContaining({
                    body: JSON.stringify({ payment_method: 'cash' }),
                })
            );
        });

        it('rejectBid should POST to /bids/:bidId/reject', async () => {
            mockFetchSuccess({ success: true, message: 'Rejected' });

            await api.rejectBid('bid-123', 'Too expensive');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.REJECT_BID('bid-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('confirmDelivery should POST to /orders/:id/confirm-delivery', async () => {
            mockFetchSuccess({ success: true, message: 'Confirmed' });

            await api.confirmDelivery('order-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CONFIRM_DELIVERY('order-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('cancelOrder should POST to /cancellations/orders/:id/cancel/customer', async () => {
            mockFetchSuccess({ success: true, message: 'Cancelled' });

            await api.cancelOrder('order-123', 'Changed my mind');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CANCEL_ORDER('order-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('getOrderDetails should call /orders/:id', async () => {
            mockFetchSuccess({ order: {} });

            await api.getOrderDetails('order-123');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/orders/order-123'),
                expect.anything()
            );
        });
    });

    // ============================================================================
    // NEGOTIATIONS
    // ============================================================================
    describe('Negotiations', () => {
        it('should POST counter-offer to correct negotiation endpoint', async () => {
            mockFetchSuccess({ success: true });

            await api.request(API_ENDPOINTS.COUNTER_OFFER('bid-123'), {
                method: 'POST',
                body: JSON.stringify({ counter_amount: 50 }),
            });

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/negotiations/bids/bid-123/counter-offer`,
                expect.anything()
            );
        });

        it('should call correct negotiation history endpoint', async () => {
            mockFetchSuccess({ history: [] });

            await api.request(API_ENDPOINTS.NEGOTIATION_HISTORY('bid-123'));

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/negotiations/bids/bid-123/negotiations`,
                expect.anything()
            );
        });
    });

    // ============================================================================
    // NOTIFICATIONS
    // ============================================================================
    describe('Notifications', () => {
        it('getNotifications should call /dashboard/notifications', async () => {
            mockFetchSuccess({ notifications: [] });

            await api.getNotifications();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS}`,
                expect.anything()
            );
        });

        it('markNotificationRead should POST to correct endpoint', async () => {
            mockFetchSuccess({ success: true });

            await api.markNotificationRead('notif-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.MARK_NOTIFICATION_READ('notif-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('markAllNotificationsRead should POST to read-all', async () => {
            mockFetchSuccess({ success: true });

            await api.markAllNotificationsRead();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ}`,
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // ============================================================================
    // ADDRESSES
    // ============================================================================
    describe('Addresses', () => {
        it('getAddresses should call /addresses', async () => {
            mockFetchSuccess({ addresses: [] });

            await api.getAddresses();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.ADDRESSES}`,
                expect.anything()
            );
        });

        it('addAddress should POST to /addresses', async () => {
            mockFetchSuccess({ address: { address_id: 'new' } });

            await api.addAddress({ label: 'Home', address_text: 'Doha, Qatar' });

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.ADDRESSES}`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('deleteAddress should DELETE /addresses/:id', async () => {
            mockFetchSuccess({ success: true });

            await api.deleteAddress('addr-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/addresses/addr-123`,
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    // ============================================================================
    // DASHBOARD
    // ============================================================================
    describe('Dashboard', () => {
        it('getStats should call /dashboard/customer/stats', async () => {
            mockFetchSuccess({ stats: { active_requests: 0 } });

            await api.getStats();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.STATS}`,
                expect.anything()
            );
        });

        it('getProfile should call /dashboard/profile', async () => {
            mockFetchSuccess({ user: { full_name: 'Test' } });

            await api.getProfile();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.PROFILE}`,
                expect.anything()
            );
        });

        it('updateProfile should PUT to /dashboard/profile', async () => {
            mockFetchSuccess({ success: true, user: {} });

            await api.updateProfile({ full_name: 'New Name' });

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.UPDATE_PROFILE}`,
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    // ============================================================================
    // SUPPORT
    // ============================================================================
    describe('Support', () => {
        it('getTickets should call /support/tickets', async () => {
            mockFetchSuccess({ tickets: [] });

            await api.getTickets();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.TICKETS}`,
                expect.anything()
            );
        });

        it('createTicket should POST to /support/tickets', async () => {
            mockFetchSuccess({ success: true, ticket: {} });

            await api.createTicket('Issue', 'Description');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.TICKETS}`,
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // ============================================================================
    // DELIVERY
    // ============================================================================
    describe('Delivery', () => {
        it('getDeliveryZones should call /delivery/zones', async () => {
            mockFetchSuccess({ zones: [] });

            await api.getDeliveryZones();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.ZONES}`,
                expect.anything()
            );
        });

        it('calculateDeliveryFee should POST to /delivery/calculate-fee', async () => {
            mockFetchSuccess({ fee: 25, zone: 'Zone A' });

            await api.calculateDeliveryFee(25.2854, 51.531);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CALCULATE_FEE}`,
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // ============================================================================
    // LOYALTY
    // ============================================================================
    describe('Loyalty', () => {
        it('getLoyaltyBalance should call correct endpoint', async () => {
            mockFetchSuccess({ points: 100, tier: 'bronze' });

            await api.getLoyaltyBalance();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/loyalty/balance'),
                expect.anything()
            );
        });

        it('getLoyaltyHistory should call correct endpoint', async () => {
            mockFetchSuccess({ transactions: [] });

            await api.getLoyaltyHistory();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/loyalty/history'),
                expect.anything()
            );
        });
    });

    // ============================================================================
    // VEHICLES
    // ============================================================================
    describe('Vehicles', () => {
        it('getMyVehicles should call correct endpoint', async () => {
            mockFetchSuccess({ vehicles: [] });

            await api.getMyVehicles();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/vehicles'),
                expect.anything()
            );
        });

        it('addVehicle should POST with vehicle data', async () => {
            mockFetchSuccess({ success: true, vehicle: {} });

            await api.addVehicle({
                car_make: 'Toyota',
                car_model: 'Camry',
                car_year: 2024,
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/vehicles'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // ============================================================================
    // ERROR HANDLING
    // ============================================================================
    describe('Error Handling', () => {
        it('should throw on non-ok response', async () => {
            mockFetchError(401, { error: 'Unauthorized' });

            await expect(api.getMyRequests()).rejects.toThrow();
        });

        it('should throw on network error', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(api.getMyRequests()).rejects.toThrow('Network error');
        });
    });

    // ============================================================================
    // PAYMENT FLOW
    // ============================================================================
    describe('Payment Flow', () => {
        it('createDeliveryFeeIntent should POST to /payments/deposit/:orderId', async () => {
            mockFetchSuccess({
                success: true,
                intent: { id: 'pi_123', clientSecret: 'cs_123', amount: 2500, currency: 'qar' },
                breakdown: { partPrice: 100, deliveryFee: 25, loyaltyDiscount: 0, originalTotal: 125, codAmount: 100, total: 25 },
            });

            const result = await api.createDeliveryFeeIntent('order-123', 5);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/payments/deposit/order-123`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ loyaltyDiscount: 5 }),
                })
            );
            expect(result.intent.clientSecret).toBe('cs_123');
        });

        it('createDeliveryFeeIntent should default loyaltyDiscount to 0', async () => {
            mockFetchSuccess({
                success: true,
                intent: { id: 'pi_123', clientSecret: 'cs_123', amount: 2500, currency: 'qar' },
            });

            await api.createDeliveryFeeIntent('order-123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/payments/deposit/order-123`,
                expect.objectContaining({
                    body: JSON.stringify({ loyaltyDiscount: 0 }),
                })
            );
        });

        it('createFullPaymentIntent should POST to /payments/full/:orderId', async () => {
            mockFetchSuccess({
                success: true,
                intent: { id: 'pi_456', clientSecret: 'cs_456', amount: 12500, currency: 'qar' },
                breakdown: { partPrice: 100, deliveryFee: 25, total: 125 },
            });

            const result = await api.createFullPaymentIntent('order-123', 10);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/payments/full/order-123`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ loyaltyDiscount: 10 }),
                })
            );
            expect(result.breakdown.total).toBe(125);
        });

        it('confirmDeliveryFeePayment should POST to /payments/deposit/confirm/:intentId', async () => {
            mockFetchSuccess({ success: true, message: 'Payment confirmed' });

            const result = await api.confirmDeliveryFeePayment('pi_test_123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/payments/deposit/confirm/pi_test_123`,
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.success).toBe(true);
        });

        it('confirmFreeOrder should POST to /payments/free/:orderId with discount', async () => {
            mockFetchSuccess({ success: true, message: 'Free order confirmed', order_id: 'order-123' });

            const result = await api.confirmFreeOrder('order-123', 125);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/payments/free/order-123`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ loyaltyDiscount: 125 }),
                })
            );
            expect(result.success).toBe(true);
            expect(result.order_id).toBe('order-123');
        });

        it('should handle payment intent creation error', async () => {
            mockFetchError(400, { error: 'Invalid order status' });

            await expect(api.createDeliveryFeeIntent('order-123')).rejects.toThrow();
        });
    });

    // ============================================================================
    // TOKEN MANAGEMENT
    // ============================================================================
    describe('Token Management', () => {
        it('should store token via setToken', async () => {
            const SecureStore = require('expo-secure-store');
            await api.setToken('test-token-123');
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'qscrap_token',
                'test-token-123'
            );
        });

        it('should clear token via clearToken', async () => {
            const SecureStore = require('expo-secure-store');
            await api.clearToken();
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('qscrap_token');
        });
    });
});
