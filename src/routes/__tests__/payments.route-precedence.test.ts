import express from 'express';
import request from 'supertest';
import router from '../payments.routes';
import { paymentService } from '../../services/payments';

jest.mock('../../middleware/auth.middleware', () => ({
    authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as express.Request & { user?: { userId: string; userType: string } }).user = {
            userId: 'user-1',
            userType: 'customer'
        };
        next();
    }
}));

jest.mock('../../config/db', () => ({
    getWritePool: jest.fn(() => ({
        query: jest.fn()
    }))
}));

jest.mock('../../services/payment/payment.service', () => ({
    getPaymentService: jest.fn(() => ({
        createDeliveryFeeDeposit: jest.fn(),
        createFullPaymentIntent: jest.fn(),
        confirmPaymentIntent: jest.fn(),
        getOrderPaymentStatus: jest.fn(),
        savePaymentMethod: jest.fn(),
        getPaymentMethods: jest.fn(),
        deletePaymentMethod: jest.fn()
    }))
}));

jest.mock('../../services/payments', () => ({
    paymentService: {
        processPayment: jest.fn(),
        refundPayment: jest.fn(),
        getUserPayments: jest.fn(),
        getTransaction: jest.fn()
    }
}));

describe('Payments route precedence', () => {
    const app = express();
    app.use(express.json());
    app.use('/', router);

    const mockedPaymentService = paymentService as unknown as {
        getUserPayments: jest.Mock;
        getTransaction: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
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
});
