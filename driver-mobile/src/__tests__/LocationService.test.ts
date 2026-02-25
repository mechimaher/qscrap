/**
 * QScrap Driver App - Location Service Unit Tests
 * Tests for src/services/LocationService.ts
 */

import { locationService } from '../services/LocationService';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Mock expo modules
jest.mock('expo-location');
jest.mock('expo-task-manager');

describe('LocationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        locationService.stopTracking();
    });

    describe('Permission Handling', () => {
        it('should request foreground and background permissions', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });

            const result = await locationService.requestPermissions();

            expect(result).toBe(true);
            expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
            expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
        });

        it('should return false when foreground permission denied', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'denied',
            });

            const result = await locationService.requestPermissions();

            expect(result).toBe(false);
            expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
        });

        it('should return false when background permission denied', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'denied',
            });

            const result = await locationService.requestPermissions();

            expect(result).toBe(false);
        });
    });

    describe('Location Tracking', () => {
        it('should start tracking location', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
            (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);

            await locationService.startTracking();

            expect(Location.hasStartedLocationUpdatesAsync).toHaveBeenCalledWith('background-location-task');
            expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
                'background-location-task',
                expect.objectContaining({
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 60000,
                    distanceInterval: 100,
                })
            );
        });

        it('should not start tracking if already started', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);

            await locationService.startTracking();

            expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
        });

        it('should stop tracking', async () => {
            (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
            (Location.stopLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);

            await locationService.stopTracking();

            expect(Location.hasStartedLocationUpdatesAsync).toHaveBeenCalledWith('background-location-task');
            expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('background-location-task');
        });

        it('should handle tracking errors gracefully', async () => {
            (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockRejectedValue(
                new Error('Location unavailable')
            );

            await expect(locationService.startTracking()).resolves.toBeUndefined();
        });
    });

    describe('Background Location', () => {
        it('should define background task', () => {
            expect(TaskManager.defineTask).toHaveBeenCalled();
        });
    });
});
