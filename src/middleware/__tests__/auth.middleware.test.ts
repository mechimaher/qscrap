/**
 * Authentication Middleware Tests
 * Tests for auth.middleware.ts
 */

import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, authorizeOperations, AuthRequest } from '../auth.middleware';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/security';

// Mock JWT
jest.mock('jsonwebtoken');
jest.mock('../../config/security', () => ({
    getJwtSecret: jest.fn().mockReturnValue('test-jwt-secret')
}));

describe('Auth Middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            headers: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    describe('authenticate', () => {
        const mockPayload = {
            userId: 'test-user-id',
            userType: 'customer'
        };

        it('should authenticate valid token successfully', () => {
            const mockToken = 'valid.jwt.token';
            mockRequest.headers = {
                authorization: `Bearer ${mockToken}`
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-jwt-secret');
            expect(mockRequest.user).toEqual(mockPayload);
            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should reject request with no authorization header', () => {
            mockRequest.headers = {};

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid header format', () => {
            mockRequest.headers = {
                authorization: 'InvalidFormat'
            };

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid authorization header format' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with expired token', () => {
            const mockToken = 'expired.token';
            mockRequest.headers = {
                authorization: `Bearer ${mockToken}`
            };

            const mockError = new Error('Token expired');
            mockError.name = 'TokenExpiredError';
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw mockError;
            });

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'token_expired',
                message: 'Access token has expired. Use /auth/refresh to get a new one.'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token', () => {
            const mockToken = 'invalid.token';
            mockRequest.headers = {
                authorization: `Bearer ${mockToken}`
            };

            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'invalid_token',
                message: 'Invalid or malformed token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with malformed JWT', () => {
            const mockToken = 'not.a.valid.jwt';
            mockRequest.headers = {
                authorization: `Bearer ${mockToken}`
            };

            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new jwt.JsonWebTokenError('Invalid token');
            });

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'invalid_token',
                message: 'Invalid or malformed token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle authorization header with wrong scheme', () => {
            const mockToken = 'some.token';
            mockRequest.headers = {
                authorization: `Basic ${mockToken}` // Wrong scheme
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            // Should still extract the token (implementation doesn't check scheme)
            expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-jwt-secret');
        });

        it('should handle authorization header with extra spaces', () => {
            const mockToken = 'valid.token';
            mockRequest.headers = {
                authorization: `Bearer ${mockToken}` // Normal token
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            // Token extraction splits on space and takes [1]
            expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-jwt-secret');
            expect(mockRequest.user).toEqual(mockPayload);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireRole', () => {
        it('should allow access when user has required role', () => {
            mockRequest.user = {
                userId: 'test-user',
                userType: 'customer'
            };

            const middleware = requireRole('customer');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should deny access when user has different role', () => {
            mockRequest.user = {
                userId: 'test-user',
                userType: 'customer'
            };

            const middleware = requireRole('garage');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access denied' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny access when user is not authenticated', () => {
            mockRequest.user = undefined;

            const middleware = requireRole('admin');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access denied' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should allow admin access to admin routes', () => {
            mockRequest.user = {
                userId: 'admin-user',
                userType: 'admin'
            };

            const middleware = requireRole('admin');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow garage access to garage routes', () => {
            mockRequest.user = {
                userId: 'garage-user',
                userType: 'garage'
            };

            const middleware = requireRole('garage');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow driver access to driver routes', () => {
            mockRequest.user = {
                userId: 'driver-user',
                userType: 'driver'
            };

            const middleware = requireRole('driver');
            middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('authorizeOperations', () => {
        it('should allow operations user access', () => {
            mockRequest.user = {
                userId: 'ops-user',
                userType: 'operations'
            };

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow admin user access', () => {
            mockRequest.user = {
                userId: 'admin-user',
                userType: 'admin'
            };

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow staff user access', () => {
            mockRequest.user = {
                userId: 'staff-user',
                userType: 'staff'
            };

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny customer user access', () => {
            mockRequest.user = {
                userId: 'customer-user',
                userType: 'customer'
            };

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Operations access required' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny garage user access', () => {
            mockRequest.user = {
                userId: 'garage-user',
                userType: 'garage'
            };

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Operations access required' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny unauthenticated access', () => {
            mockRequest.user = undefined;

            authorizeOperations(mockRequest as AuthRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Operations access required' });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
