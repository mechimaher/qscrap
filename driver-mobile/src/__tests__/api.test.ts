/**
 * QScrap Driver App - API Service Unit Tests
 * Tests for src/services/api.ts
 */

import { api, API_ENDPOINTS } from '../services/api';
import * as SecureStore from 'expo-secure-store';

// Mock SecureStore
jest.mock('expo-secure-store');

describe('API Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api as any).token = null;
        (api as any).refreshTokenValue = null;
    });

    describe('Token Management', () => {
        it('should return null when no token exists', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

            const token = await api.getToken();

            expect(token).toBeNull();
            expect(SecureStore.getItemAsync).toHaveBeenCalledWith('qscrap_driver_token');
        });

        it('should return cached token if available', async () => {
            (api as any).token = 'cached-token';

            const token = await api.getToken();

            expect(token).toBe('cached-token');
            expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
        });

        it('should set token in memory and SecureStore', async () => {
            await api.setToken('new-token');

            expect((api as any).token).toBe('new-token');
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('qscrap_driver_token', 'new-token');
        });

        it('should clear all tokens', async () => {
            (api as any).token = 'test-token';
            (api as any).refreshTokenValue = 'test-refresh';

            await api.clearToken();

            expect((api as any).token).toBeNull();
            expect((api as any).refreshTokenValue).toBeNull();
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('qscrap_driver_token');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('qscrap_driver_refresh_token');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('qscrap_driver_user');
        });
    });

    describe('Authentication', () => {
        describe('login', () => {
            it('should POST to /auth/driver/login with credentials', async () => {
                const mockResponse = {
                    token: 'test-token',
                    refreshToken: 'test-refresh',
                    userId: 'driver-123',
                    userType: 'driver',
                };

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockResponse),
                    headers: { get: () => 'application/json' },
                });

                const result = await api.login('55551234', 'password123');

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/auth/driver/login'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                        }),
                        body: JSON.stringify({
                            phone_number: '55551234',
                            password: 'password123',
                        }),
                    })
                );

                expect(result.token).toBe('test-token');
            });

            it('should throw error on invalid credentials', async () => {
                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Invalid credentials' }),
                    headers: { get: () => 'application/json' },
                });

                await expect(api.login('55551234', 'wrong-password'))
                    .rejects.toThrow('Invalid credentials');
            });
        });

        describe('serverLogout', () => {
            it('should POST to /auth/logout with refresh token', async () => {
                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-refresh');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                    headers: { get: () => 'application/json' },
                });

                await api.serverLogout();

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/auth/logout'),
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify({ refreshToken: 'test-refresh' }),
                    })
                );
            });
        });
    });

    describe('Driver Profile', () => {
        describe('getProfile', () => {
            it('should GET /driver/profile with auth token', async () => {
                const mockDriver = {
                    driver_id: 'driver-123',
                    full_name: 'John Doe',
                    phone: '55551234',
                    vehicle_type: 'Van',
                    vehicle_plate: 'ABC123',
                    status: 'available',
                };

                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ driver: mockDriver }),
                    headers: { get: () => 'application/json' },
                });

                const result = await api.getProfile();

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/profile'),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            Authorization: 'Bearer test-token',
                        }),
                    })
                );

                expect(result.driver).toEqual(mockDriver);
            });
        });

        describe('toggleAvailability', () => {
            it('should PUT /driver/toggle-availability with status', async () => {
                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
                
                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true, status: 'offline' }),
                    headers: { get: () => 'application/json' },
                });
                
                await api.toggleAvailability('offline');
                
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/toggle-availability'),
                    expect.objectContaining({
                        method: 'PUT',
                        body: JSON.stringify({ status: 'offline' }),
                    })
                );
            });
        });
    });

    describe('Assignments', () => {
        describe('getAssignments', () => {
            it('should GET /driver/assignments with filter', async () => {
                const mockAssignments = [
                    {
                        assignment_id: 'assign-1',
                        order_id: 'order-1',
                        status: 'assigned',
                        assignment_type: 'delivery',
                    },
                ];

                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ assignments: mockAssignments }),
                    headers: { get: () => 'application/json' },
                });

                const result = await api.getAssignments('active');

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/assignments?filter=active'),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            Authorization: 'Bearer test-token',
                        }),
                    })
                );

                expect(result.assignments).toEqual(mockAssignments);
            });
        });

        describe('getAssignmentDetails', () => {
            it('should GET /driver/assignments/:id', async () => {
                const mockAssignment = {
                    assignment_id: 'assign-1',
                    order_id: 'order-1',
                    pickup_address: 'Garage A',
                    delivery_address: 'Customer B',
                    status: 'in_transit',
                };

                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ assignment: mockAssignment }),
                    headers: { get: () => 'application/json' },
                });

                const result = await api.getAssignmentDetails('assign-1');

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/assignments/assign-1'),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            Authorization: 'Bearer test-token',
                        }),
                    })
                );

                expect(result.assignment).toEqual(mockAssignment);
            });
        });

        describe('acceptAssignment', () => {
            it('should POST /driver/assignments/:id/accept', async () => {
                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                    headers: { get: () => 'application/json' },
                });

                await api.acceptAssignment('assign-1');

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/assignments/assign-1/accept'),
                    expect.objectContaining({
                        method: 'POST',
                    })
                );
            });
        });

        describe('updateAssignmentStatus', () => {
            it('should PUT /driver/assignments/:id/status', async () => {
                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                    headers: { get: () => 'application/json' },
                });

                await api.updateAssignmentStatus('assign-1', 'picked_up');

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/assignments/assign-1/status'),
                    expect.objectContaining({
                        method: 'PUT',
                        body: JSON.stringify({ status: 'picked_up' }),
                    })
                );
            });
        });
    });

    describe('Proof of Delivery', () => {
        describe('uploadProof', () => {
            it('should POST /driver/assignments/:id/pod with photo and signature', async () => {
                (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
                
                const mockFetch = global.fetch as jest.Mock;
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                    headers: { get: () => 'application/json' },
                });
                
                const result = await api.uploadProof(
                    'assign-1',
                    'base64-photo-data',
                    'base64-signature-data',
                    'Payment: cash',
                    'cash'
                );
                
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/driver/assignments/assign-1/pod'),
                    expect.objectContaining({
                        method: 'POST',
                    })
                );
                
                expect(result.success).toBe(true);
            });
        });
    });

    describe('Error Handling', () => {
        it('should throw on non-ok response', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

            const mockFetch = global.fetch as jest.Mock;
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Unauthorized' }),
                headers: { get: () => 'application/json' },
            });

            await expect(api.getProfile()).rejects.toThrow('Unauthorized');
        });

        it('should throw on network error', async () => {
            const mockFetch = global.fetch as jest.Mock;
            mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

            await expect(api.getProfile()).rejects.toThrow('Network request failed');
        });

        it('should handle timeout correctly', async () => {
            jest.useFakeTimers();
            const mockFetch = global.fetch as jest.Mock;

            mockFetch.mockImplementationOnce(() => new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 20000);
            }));

            const profilePromise = api.getProfile();
            jest.runAllTimers();

            await expect(profilePromise).rejects.toThrow();
            jest.useRealTimers();
        });
    });

    describe('Token Refresh', () => {
        it('should attempt token refresh on 401', async () => {
            (SecureStore.getItemAsync as jest.Mock)
                .mockResolvedValueOnce('test-token')
                .mockResolvedValueOnce('test-refresh');

            const mockFetch = global.fetch as jest.Mock;

            // First call returns 401
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Unauthorized' }),
                headers: { get: () => 'application/json' },
            });

            // Refresh call succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ token: 'new-token' }),
                headers: { get: () => 'application/json' },
            });

            // Retry succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ driver: { driver_id: '123' } }),
                headers: { get: () => 'application/json' },
            });

            const result = await api.getProfile();

            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(result.driver).toBeDefined();
        });
    });
});
