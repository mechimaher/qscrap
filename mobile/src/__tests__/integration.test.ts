/**
 * QScrap Mobile - Integration Tests
 * Tests complete critical user flows end-to-end with mocked API
 * Validates the full business logic path from action to result
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// Mock logger
jest.mock('../utils/logger', () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

import { api } from '../services/api';

// Helper
const mockFetch = (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(data),
        headers: new Map([['content-type', 'application/json']]),
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
});

describe('Integration: Critical User Flows', () => {
    // ============================================================================
    // FLOW 1: Login → Dashboard → Create Request
    // ============================================================================
    describe('Login → Dashboard → Create Request', () => {
        it('should complete full flow from login to request creation', async () => {
            // Step 1: Login
            mockFetch({ token: 'jwt-token', userId: 'user-1', userType: 'customer' });
            const loginResult = await api.login('33334444', 'password123');
            expect(loginResult.token).toBe('jwt-token');

            // Step 2: Get dashboard stats
            mockFetch({ stats: { active_requests: 0, total_orders: 5 } });
            const statsResult = await api.getStats();
            expect(statsResult.stats.active_requests).toBe(0);

            // Step 3: Get profile
            mockFetch({ user: { full_name: 'Test User', phone_number: '33334444' } });
            const profileResult = await api.getProfile();
            expect(profileResult.user.full_name).toBe('Test User');

            // Verify 3 API calls were made
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    // ============================================================================
    // FLOW 2: Request → Bids → Accept → Order → Payment
    // ============================================================================
    describe('Request → Accept Bid → Order Creation', () => {
        it('should flow from viewing bids to order creation', async () => {
            // Step 1: Get request details with bids
            mockFetch({
                request: { request_id: 'req-1', status: 'active' },
                bids: [
                    { bid_id: 'bid-1', bid_amount: 100, garage_name: 'Test Garage' },
                    { bid_id: 'bid-2', bid_amount: 150, garage_name: 'Other Garage' },
                ],
            });
            const reqResult = await api.getRequestDetails('req-1');
            expect(reqResult.bids).toHaveLength(2);

            // Step 2: Accept the cheapest bid
            mockFetch({ success: true, order_id: 'order-1', message: 'Order created' });
            const acceptResult = await api.acceptBid('bid-1');
            expect(acceptResult.success).toBe(true);
            expect(acceptResult.order_id).toBe('order-1');

            // Step 3: View the created order
            mockFetch({
                order: {
                    order_id: 'order-1',
                    order_status: 'pending_payment',
                    total_amount: 125,
                },
            });
            const orderResult = await api.getOrderDetails('order-1');
            expect(orderResult.order.order_status).toBe('pending_payment');

            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    // ============================================================================
    // FLOW 3: Order → Delivery → Confirmation → Review
    // ============================================================================
    describe('Order → Confirm Delivery → Submit Review', () => {
        it('should complete delivery confirmation and review flow', async () => {
            // Step 1: Confirm delivery
            mockFetch({ success: true, message: 'Delivery confirmed' });
            const confirmResult = await api.confirmDelivery('order-123');
            expect(confirmResult.success).toBe(true);

            // Step 2: Submit review
            mockFetch({ success: true, message: 'Review submitted' });
            const reviewResult = await api.submitReview('order-123', {
                overall_rating: 5,
                part_quality_rating: 5,
                communication_rating: 4,
                delivery_rating: 5,
                review_text: 'Excellent service!',
            });
            expect(reviewResult.success).toBe(true);

            // Verify review call went to correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.SUBMIT_REVIEW('order-123')}`,
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // ============================================================================
    // FLOW 4: Cancellation Flow
    // ============================================================================
    describe('Order Cancellation Flow', () => {
        it('should preview and execute cancellation', async () => {
            // Step 1: Get cancellation preview
            mockFetch({
                canCancel: true,
                refund_amount: 100,
                penalty_fee: 0,
                stage: 'before_pickup',
            });
            const preview = await api.getCancellationPreview('order-123');
            expect(preview.canCancel).toBe(true);

            // Step 2: Execute cancellation
            mockFetch({ success: true, message: 'Order cancelled', refund_amount: 100 });
            const cancelResult = await api.cancelOrder('order-123', 'Changed my mind');
            expect(cancelResult.success).toBe(true);

            // Verify cancellation used the correct route
            expect(global.fetch).toHaveBeenLastCalledWith(
                `${API_BASE_URL}${API_ENDPOINTS.CANCEL_ORDER('order-123')}`,
                expect.anything()
            );
        });
    });

    // ============================================================================
    // FLOW 5: Return Request Flow (Post-Delivery)
    // ============================================================================
    describe('Post-Delivery Return Flow', () => {
        it('should preview and create return request', async () => {
            // Step 1: Get return preview
            mockFetch({
                order_id: 'order-123',
                can_return: true,
                return_fee: 15,
                delivery_fee_retained: 25,
                refund_amount: 60,
                days_remaining: 5,
            });
            const preview = await api.getReturnPreview('order-123');
            expect(preview.can_return).toBe(true);
            expect(preview.refund_amount).toBe(60);

            // Step 2: Create return request
            mockFetch({
                success: true,
                return_id: 'return-1',
                refund_amount: 60,
                message: 'Return request created',
            });
            const returnResult = await api.createReturnRequest('order-123', {
                reason: 'wrong_part',
                photo_urls: ['photo1.jpg'],
                condition_description: 'Part does not fit',
            });
            expect(returnResult.success).toBe(true);
        });
    });

    // ============================================================================
    // FLOW 6: Bid Negotiation Flow
    // ============================================================================
    describe('Bid Negotiation Flow', () => {
        it('should complete counter-offer negotiation cycle', async () => {
            // Step 1: Get negotiation history
            mockFetch({ history: [] });
            const history = await api.request(API_ENDPOINTS.NEGOTIATION_HISTORY('bid-1'));
            expect(history.history).toEqual([]);

            // Step 2: Send counter-offer
            mockFetch({ success: true, counter_offer_id: 'co-1' });
            await api.request(API_ENDPOINTS.COUNTER_OFFER('bid-1'), {
                method: 'POST',
                body: JSON.stringify({ counter_amount: 80 }),
            });

            // Step 3: Respond to garage counter
            mockFetch({ success: true, message: 'Accepted' });
            await api.request(API_ENDPOINTS.RESPOND_TO_COUNTER('co-1'), {
                method: 'POST',
                body: JSON.stringify({ action: 'accept' }),
            });

            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    // ============================================================================
    // FLOW 7: Notification Lifecycle
    // ============================================================================
    describe('Notification Lifecycle', () => {
        it('should fetch, read, and clear notifications', async () => {
            // Step 1: Get notifications
            mockFetch({
                notifications: [
                    { notification_id: 'n1', is_read: false, title: 'New bid' },
                    { notification_id: 'n2', is_read: false, title: 'Order update' },
                ],
            });
            const notifs = await api.getNotifications();
            expect(notifs.notifications).toHaveLength(2);

            // Step 2: Mark one as read
            mockFetch({ success: true });
            await api.markNotificationRead('n1');

            // Step 3: Mark all as read
            mockFetch({ success: true });
            await api.markAllNotificationsRead();

            // Step 4: Clear all
            mockFetch({ success: true });
            await api.clearAllNotifications();

            expect(global.fetch).toHaveBeenCalledTimes(4);
        });
    });

    // ============================================================================
    // FLOW 8: Address Management
    // ============================================================================
    describe('Address Management', () => {
        it('should CRUD addresses', async () => {
            // Create
            mockFetch({ address: { address_id: 'addr-1', label: 'Home' } });
            const created = await api.addAddress({
                label: 'Home',
                address_text: 'West Bay, Doha',
                latitude: 25.3548,
                longitude: 51.1839,
            });
            expect(created.address.label).toBe('Home');

            // Read
            mockFetch({ addresses: [{ address_id: 'addr-1', label: 'Home' }] });
            const addresses = await api.getAddresses();
            expect(addresses.addresses).toHaveLength(1);

            // Set default
            mockFetch({ success: true });
            await api.setDefaultAddress('addr-1');

            // Delete
            mockFetch({ success: true });
            await api.deleteAddress('addr-1');

            expect(global.fetch).toHaveBeenCalledTimes(4);
        });
    });

    // ============================================================================
    // FLOW 9: Vehicle Fleet Management
    // ============================================================================
    describe('Vehicle Fleet Management', () => {
        it('should CRUD vehicles', async () => {
            // Add vehicle
            mockFetch({ success: true, vehicle: { vehicle_id: 'v-1' } });
            const added = await api.addVehicle({
                car_make: 'Toyota',
                car_model: 'Camry',
                car_year: 2024,
            });
            expect(added.success).toBe(true);

            // Get vehicles
            mockFetch({ vehicles: [{ vehicle_id: 'v-1', car_make: 'Toyota' }] });
            const vehicles = await api.getMyVehicles();
            expect(vehicles.vehicles).toHaveLength(1);

            // Update
            mockFetch({ success: true, vehicle: {} });
            await api.updateVehicle('v-1', { nickname: 'Family Car' });

            // Delete
            mockFetch({ success: true });
            await api.deleteVehicle('v-1');

            expect(global.fetch).toHaveBeenCalledTimes(4);
        });
    });

    // ============================================================================
    // FLOW 10: Account Deletion Safety
    // ============================================================================
    describe('Account Deletion Safety', () => {
        it('should check eligibility before deletion', async () => {
            // Step 1: Check eligibility (has active orders — blocked)
            mockFetch({
                canDelete: false,
                blockers: [
                    {
                        type: 'active_orders',
                        count: 2,
                        message: 'You have 2 active orders',
                        action: 'Complete or cancel your orders',
                    },
                ],
            });
            const eligibility = await api.checkDeletionEligibility();
            expect(eligibility.canDelete).toBe(false);
            expect(eligibility.blockers).toHaveLength(1);

            // Step 2: After resolving blockers, check again
            mockFetch({ canDelete: true, blockers: [] });
            const recheck = await api.checkDeletionEligibility();
            expect(recheck.canDelete).toBe(true);

            // Step 3: Delete account
            mockFetch({ success: true, message: 'Account deleted' });
            const deleteResult = await api.deleteAccount();
            expect(deleteResult.success).toBe(true);

            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });
});
