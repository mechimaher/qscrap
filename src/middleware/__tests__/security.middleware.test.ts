/**
 * Security Middleware Tests
 * Tests for security.middleware.ts
 */

import { Request, Response, NextFunction } from 'express';
import {
    securityMiddleware,
    additionalSecurityHeaders,
    sanitizeRequest
} from '../security.middleware';

describe('Security Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            headers: {}
        };
        mockResponse = {
            setHeader: jest.fn(),
            getHeader: jest.fn()
        };
        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    describe('securityMiddleware (Helmet)', () => {
        it('should be a function', () => {
            expect(typeof securityMiddleware).toBe('function');
        });

        it('should call next when used as middleware', () => {
            // Helmet middleware requires proper response object with removeHeader
            const mockResWithRemove = {
                ...mockResponse,
                removeHeader: jest.fn(),
                setHeader: jest.fn()
            };
            securityMiddleware(mockRequest as Request, mockResWithRemove as unknown as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('additionalSecurityHeaders', () => {
        it('should set cache control headers', () => {
            additionalSecurityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
        });

        it('should set permissions policy header', () => {
            additionalSecurityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                'Permissions-Policy',
                'geolocation=(self), microphone=(), camera=(self)'
            );
        });

        it('should call next middleware', () => {
            additionalSecurityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should set all security headers in correct order', () => {
            additionalSecurityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify all headers are set
            expect(mockResponse.setHeader).toHaveBeenCalledTimes(4); // Cache-Control, Pragma, Expires, Permissions-Policy
            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    describe('sanitizeRequest', () => {
        it('should sanitize string values in request body', () => {
            mockRequest.body = {
                name: '<script>alert("xss")</script>Test',
                description: 'Normal text'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.name).not.toContain('<script>');
            expect(mockRequest.body.description).toBe('Normal text');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should remove javascript: protocol from strings', () => {
            mockRequest.body = {
                url: 'javascript:alert("xss")',
                safe: 'https://example.com'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.url).not.toContain('javascript:');
            expect(mockRequest.body.safe).toBe('https://example.com');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should remove on* event handlers from strings', () => {
            mockRequest.body = {
                html: '<img src="x" onerror="alert(1)">'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.html).not.toContain('onerror=');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should sanitize nested objects', () => {
            mockRequest.body = {
                user: {
                    name: '<script>bad()</script>',
                    email: 'test@example.com'
                }
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.user.name).not.toContain('<script>');
            expect(mockRequest.body.user.email).toBe('test@example.com');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should sanitize arrays of strings', () => {
            mockRequest.body = {
                tags: ['safe', '<script>bad()</script>', 'also-safe']
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.tags[0]).toBe('safe');
            expect(mockRequest.body.tags[1]).not.toContain('<script>');
            expect(mockRequest.body.tags[2]).toBe('also-safe');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should sanitize arrays of objects', () => {
            mockRequest.body = {
                items: [
                    { name: '<script>xss()</script>' },
                    { name: 'safe-item' }
                ]
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.items[0].name).not.toContain('<script>');
            expect(mockRequest.body.items[1].name).toBe('safe-item');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle null and undefined values', () => {
            mockRequest.body = {
                nullValue: null,
                undefinedValue: undefined,
                normalValue: 'test'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.nullValue).toBeNull();
            expect(mockRequest.body.undefinedValue).toBeUndefined();
            expect(mockRequest.body.normalValue).toBe('test');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle empty body', () => {
            mockRequest.body = {};

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body).toEqual({});
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle missing body', () => {
            mockRequest.body = undefined;

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should preserve numbers and booleans', () => {
            mockRequest.body = {
                count: 42,
                isActive: true,
                price: 99.99
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.count).toBe(42);
            expect(mockRequest.body.isActive).toBe(true);
            expect(mockRequest.body.price).toBe(99.99);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle complex nested structures', () => {
            mockRequest.body = {
                level1: {
                    level2: {
                        level3: {
                            dangerous: '<script>nested()</script>',
                            safe: 'normal text'
                        }
                    }
                }
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.level1.level2.level3.dangerous).not.toContain('<script>');
            expect(mockRequest.body.level1.level2.level3.safe).toBe('normal text');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should remove multiple script tags', () => {
            mockRequest.body = {
                content: '<script>first()</script>Text<script>second()</script>'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.content).not.toContain('<script>');
            expect(mockRequest.body.content).toContain('Text');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle case-insensitive script tags', () => {
            mockRequest.body = {
                content: '<SCRIPT>alert(1)</SCRIPT>'
            };

            sanitizeRequest(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockRequest.body.content).not.toContain('<SCRIPT>');
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
