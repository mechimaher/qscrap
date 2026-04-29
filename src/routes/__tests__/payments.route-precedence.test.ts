import express from 'express';
import request from 'supertest';
import router from '../payments.routes';
import { paymentService } from '../../services/payments';
import { getWritePool } from '../../config/db';
import { LoyaltyService } from '../../services/loyalty.service';

jest.mock('../../middleware/auth.middleware', () => ({
    authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as express.Request & { user?: { userId: string; userType: string } }).user = {
            userId: 'user-1',
            userType: 'customer'
        };
        next();
    }
}));

jest.mock('../../config/db', () => {
    const mockPool = {
        query: jest.fn()
    };

    return {
        __esModule: true,
        default: mockPool,
        getWritePool: jest.fn(() => mockPool)
    };
});

jest.mock('../../services/payment/payment.service', () => {
    const mockDepositService = {
        createDeliveryFeeDeposit: jest.fn(),
        createFullPaymentIntent: jest.fn(),
        confirmPaymentIntent: jest.fn(),
        getOrderPaymentStatus: jest.fn(),
        savePaymentMethod: jest.fn(),
        getPaymentMethods: jest.fn(),
        deletePaymentMethod: jest.fn()
    };

    return {
        getPaymentService: jest.fn(() => mockDepositService)
    };
});

jest.mock('../../services/payments', () => ({
    paymentService: {
        processPayment: jest.fn(),
        refundPayment: jest.fn(),
        getUserPayments: jest.fn(),
        getTransaction: jest.fn()
    }
}));

jest.mock('../../services/loyalty.service', () => ({
    LoyaltyService: {
        calculateTierDiscount: jest.fn()
    }
}));

describe('Payments route precedence', () => {
    const app = express();
    app.use(express.json());
    app.use('/', router);

    const mockPool = getWritePool() as unknown as { query: jest.Mock };
    const mockedLoyaltyService = LoyaltyService as unknown as {
        calculateTierDiscount: jest.Mock;
    };
    const mockedPaymentService = paymentService as unknown as {
        getUserPayments: jest.Mock;
        getTransaction: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockPool.query.mockReset();
        mockedLoyaltyService.calculateTierDiscount.mockReset();
        mockedPaymentService.getUserPayments.mockResolvedValue([]);
        mockedPaymentService.getTransaction.mockResolvedValue({
            transaction_id: 'txn-1',
            user_id: 'user-1'
        });
    });

    it('routes GET /my to payment history (not /:transactionId)', async () => {
        const response = await request(app).get('/my');

        expect(response.status).toBe(200);
        expect(mockedPaymentService.getUserPayments).toHaveBeenCalledWith('user-1', 50);
        expect(mockedPaymentService.getTransaction).not.toHaveBeenCalled();
    });

    it('routes GET /test-cards to static endpoint (not /:transactionId)', async () => {
        const response = await request(app).get('/test-cards');
        const body = response.body as { success?: boolean };

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockedPaymentService.getTransaction).not.toHaveBeenCalled();
    });

    it('routes GET /:transactionId to transaction lookup', async () => {
        const response = await request(app).get('/txn_123');

        expect(response.status).toBe(200);
        expect(mockedPaymentService.getTransaction).toHaveBeenCalledWith('txn_123');
    });

    it('rejects free-order confirmation when only the client-supplied discount covers the total', async () => {
        mockPool.query.mockResolvedValueOnce({
            rows: [{
                part_price: '100',
                delivery_fee: '25',
                customer_id: 'user-1',
                order_status: 'pending_payment'
            }]
        });
        mockedLoyaltyService.calculateTierDiscount.mockResolvedValue({
            discountAmount: 0,
            discountPercentage: 0,
            tier: 'bronze'
        });

        const response = await request(app)
            .post('/free/order-1')
            .send({ loyaltyDiscount: 99999 });

        expect(response.status).toBe(400);
        expect(mockedLoyaltyService.calculateTierDiscount).toHaveBeenCalledWith('user-1', 125);
        expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('confirms free orders only when the server-computed loyalty discount covers the total', async () => {
        mockPool.query
            .mockResolvedValueOnce({
                rows: [{
                    part_price: '100',
                    delivery_fee: '25',
                    customer_id: 'user-1',
                    order_status: 'pending_payment'
                }]
            })
            .mockResolvedValueOnce({ rowCount: 1, rows: [] });
        mockedLoyaltyService.calculateTierDiscount.mockResolvedValue({
            discountAmount: 125,
            discountPercentage: 100,
            tier: 'vvip'
        });

        const response = await request(app)
            .post('/free/order-1')
            .send({ applyLoyalty: true });

        expect(response.status).toBe(200);
        expect(response.body.breakdown.loyaltyDiscount).toBe(125);
        expect(mockPool.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE orders SET'), ['order-1', 125]);
    });
});
