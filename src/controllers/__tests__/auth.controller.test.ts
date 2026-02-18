// Define mock objects first (must start with 'mock' to be used in jest.mock factory)
const mockAuthService = {
    registerUser: jest.fn(),
    checkUserExists: jest.fn(),
    login: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    deleteAccount: jest.fn()
};

const mockDeletionService = {
    deleteAccount: jest.fn(),
    checkDeletionEligibility: jest.fn()
};

const mockOtpService = {
    createOTP: jest.fn(),
    verifyOTP: jest.fn(),
    invalidateOTPs: jest.fn()
};

const mockEmailService = {
    sendOTPEmail: jest.fn()
};

// Mock dependencies
jest.mock('../../services/auth', () => ({
    AuthService: jest.fn().mockImplementation(() => mockAuthService)
}));

jest.mock('../../services/auth/account-deletion.service', () => ({
    AccountDeletionService: jest.fn().mockImplementation(() => mockDeletionService)
}));

jest.mock('../../services/otp.service', () => ({
    otpService: mockOtpService
}));

jest.mock('../../services/email.service', () => ({
    emailService: mockEmailService
}));

const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn()
};

jest.mock('../../config/db', () => ({
    __esModule: true,
    default: mockPool,
    getReadPool: jest.fn(() => mockPool),
    getWritePool: jest.fn(() => mockPool)
}));

jest.mock('../../utils/catchAsync', () => ({
    catchAsync: (fn: any) => fn
}));

// Import the controller AFTER mocks are defined
import * as authController from '../../controllers/auth.controller';
import pool from '../../config/db';
import { Request, Response } from 'express';


describe('Auth Controller', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockNext = jest.fn();
        mockResponse = {
            status: mockStatus,
            json: mockJson,
            cookie: jest.fn(),
            clearCookie: jest.fn()
        };
        mockRequest = {
            body: {},
            params: {},
            query: {},
            headers: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' }
        };

        // Reset all mocks
        jest.clearAllMocks();
        mockAuthService.checkUserExists.mockResolvedValue(false);
        mockAuthService.registerUser.mockResolvedValue({});
        mockAuthService.login.mockResolvedValue({});
        mockPool.query.mockResolvedValue({ rows: [] });
    });

    describe('register', () => {
        const mockRegisterData = {
            phone_number: '+97430000001',
            password: 'password123',
            user_type: 'customer' as const,
            full_name: 'Test Customer'
        };

        const mockRegisterResult = {
            token: 'mock.jwt.token',
            refreshToken: 'mock.refresh.token',
            userId: 'test-user-id',
            userType: 'customer'
        };

        it('should register a new customer successfully', async () => {
            mockAuthService.checkUserExists.mockResolvedValue(false);
            mockAuthService.registerUser.mockResolvedValue(mockRegisterResult);

            mockRequest.body = mockRegisterData;

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith({
                token: mockRegisterResult.token,
                refreshToken: mockRegisterResult.refreshToken,
                userId: mockRegisterResult.userId,
                userType: mockRegisterResult.userType
            });
        });

        it('should reject registration with missing phone number', async () => {
            mockRequest.body = {
                password: 'password123',
                user_type: 'customer'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('phone_number') })
            );
        });

        it('should reject registration with missing password', async () => {
            mockRequest.body = {
                phone_number: '+97430000001',
                user_type: 'customer'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('password') })
            );
        });

        it('should reject registration with invalid phone number', async () => {
            mockRequest.body = {
                ...mockRegisterData,
                phone_number: '123'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Invalid phone number') })
            );
        });

        it('should reject registration with short password', async () => {
            mockRequest.body = {
                ...mockRegisterData,
                password: '123'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('at least 4 characters') })
            );
        });

        it('should reject registration with invalid user_type', async () => {
            mockRequest.body = {
                ...mockRegisterData,
                user_type: 'invalid_type'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                error: 'Invalid user_type. Must be "customer" or "garage"'
            });
        });

        it('should reject duplicate phone number', async () => {
            mockAuthService.checkUserExists.mockResolvedValue(true);

            mockRequest.body = mockRegisterData;

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('already exists') })
            );
        });

        it('should require garage_name for garage registration', async () => {
            mockRequest.body = {
                phone_number: '+97430000001',
                password: 'password123',
                user_type: 'garage'
            };

            await authController.register(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Garage name') })
            );
        });
    });

    describe('login', () => {
        const mockLoginData = {
            phone_number: '+97430000001',
            password: 'password123'
        };

        const mockLoginResult = {
            token: 'mock.jwt.token',
            refreshToken: 'mock.refresh.token',
            userId: 'test-user-id',
            userType: 'customer'
        };

        beforeEach(() => {
            mockAuthService.login.mockReset();
        });

        it('should login successfully with valid credentials', async () => {
            mockAuthService.login.mockResolvedValue(mockLoginResult);

            mockRequest.body = mockLoginData;

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith(mockLoginResult);
        });

        it('should reject login with missing phone number', async () => {
            mockRequest.body = { password: 'password123' };

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Phone number') })
            );
        });

        it('should reject login with missing password', async () => {
            mockRequest.body = { phone_number: '+97430000001' };

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('password') })
            );
        });

        it('should handle invalid credentials error', async () => {
            mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

            mockRequest.body = mockLoginData;

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(401);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Invalid credentials' })
            );
        });

        it('should handle account deactivated error', async () => {
            mockAuthService.login.mockRejectedValue(new Error('Account deactivated'));

            mockRequest.body = mockLoginData;

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Account deactivated',
                    message: expect.stringContaining('contact support')
                })
            );
        });

        it('should handle account suspended error', async () => {
            mockAuthService.login.mockRejectedValue(new Error('Account suspended'));

            mockRequest.body = mockLoginData;

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Account suspended'
                })
            );
        });

        it('should handle pending approval error', async () => {
            mockAuthService.login.mockRejectedValue(new Error('pending_approval'));

            mockRequest.body = mockLoginData;

            await authController.login(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'pending_approval',
                    status: 'pending'
                })
            );
        });
    });

    describe('refreshToken', () => {
        const mockRefreshResult = {
            token: 'new.jwt.token',
            refreshToken: 'new.refresh.token'
        };

        beforeEach(() => {
            mockAuthService.refreshAccessToken.mockReset();
        });

        it('should refresh token successfully', async () => {
            mockAuthService.refreshAccessToken.mockResolvedValue(mockRefreshResult);

            mockRequest.body = { refreshToken: 'valid.refresh.token' };

            await authController.refreshToken(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith(mockRefreshResult);
        });

        it('should reject refresh with missing token', async () => {
            mockRequest.body = {};

            await authController.refreshToken(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'refreshToken is required' })
            );
        });

        it('should handle expired refresh token', async () => {
            mockAuthService.refreshAccessToken.mockRejectedValue(new Error('Token expired'));

            mockRequest.body = { refreshToken: 'expired.token' };

            await authController.refreshToken(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(401);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'invalid_refresh_token',
                    message: expect.stringContaining('expired')
                })
            );
        });
    });

    describe('logout', () => {
        beforeEach(() => {
            mockAuthService.revokeRefreshToken.mockReset();
        });

        it('should logout successfully', async () => {
            mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

            mockRequest.body = { refreshToken: 'valid.token' };

            await authController.logout(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith({ message: 'Logged out successfully' });
        });

        it('should handle logout without refresh token', async () => {
            mockRequest.body = {};

            await authController.logout(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith({ message: 'Logged out successfully' });
        });
    });

    describe('deleteAccount', () => {
        const mockUser = { userId: 'test-user-id', userType: 'customer' };

        beforeEach(() => {
            mockDeletionService.deleteAccount.mockReset();
        });

        it('should delete account successfully', async () => {
            mockAuthService.deleteAccount.mockResolvedValue(undefined);

            (mockRequest as any).user = mockUser;

            await authController.deleteAccount(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith({ message: 'Account deleted successfully' });
        });

        it('should reject unauthenticated request', async () => {
            (mockRequest as any).user = undefined;

            await authController.deleteAccount(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(401);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Unauthorized' })
            );
        });

        it('should handle user not found', async () => {
            mockAuthService.deleteAccount.mockRejectedValue(new Error('User not found'));

            (mockRequest as any).user = mockUser;

            await authController.deleteAccount(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'User not found' })
            );
        });
    });

    describe('checkDeletionEligibility', () => {
        const mockUser = { userId: 'test-user-id', userType: 'customer' };
        const mockDeletionCheck = {
            eligible: true,
            blockers: []
        };

        beforeEach(() => {
            mockDeletionService.checkDeletionEligibility.mockReset();
        });

        it('should check deletion eligibility successfully', async () => {
            mockDeletionService.checkDeletionEligibility.mockResolvedValue(mockDeletionCheck);

            (mockRequest as any).user = mockUser;

            await authController.checkDeletionEligibility(mockRequest as Request, mockResponse as Response);

            expect(mockJson).toHaveBeenCalledWith(mockDeletionCheck);
        });

        it('should reject unauthenticated request', async () => {
            (mockRequest as any).user = undefined;

            await authController.checkDeletionEligibility(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(401);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Unauthorized' })
            );
        });
    });

    describe('registerWithEmail', () => {
        const mockRegisterData = {
            full_name: 'Test Customer',
            email: 'test@example.com',
            phone_number: '+97430000001',
            password: 'password123'
        };

        const mockOTPResult = {
            success: true,
            otp: '123456',
            expiresAt: new Date(Date.now() + 600000)
        };

        beforeEach(() => {
            mockAuthService.checkUserExists.mockReset();
            mockOtpService.createOTP.mockReset();
            mockEmailService.sendOTPEmail.mockReset();
        });

        it('should register with email successfully', async () => {
            mockAuthService.checkUserExists.mockResolvedValue(false);
            mockOtpService.createOTP.mockResolvedValue(mockOTPResult);
            mockEmailService.sendOTPEmail.mockResolvedValue(true);

            mockRequest.body = mockRegisterData;

            await authController.registerWithEmail(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('Verification code')
                })
            );
        });

        it('should reject registration with missing fields', async () => {
            mockRequest.body = { full_name: 'Test', email: 'test@example.com' };

            await authController.registerWithEmail(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Missing') })
            );
        });

        it('should reject registration with invalid email', async () => {
            mockRequest.body = { ...mockRegisterData, email: 'invalid-email' };

            await authController.registerWithEmail(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Invalid email') })
            );
        });

        it('should reject registration with invalid phone', async () => {
            mockRequest.body = { ...mockRegisterData, phone_number: '123' };

            await authController.registerWithEmail(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Invalid phone') })
            );
        });

        it('should reject registration with short password', async () => {
            mockRequest.body = { ...mockRegisterData, password: '12345' };

            await authController.registerWithEmail(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('6 characters') })
            );
        });
    });
});
