import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useSubmitRequest } from '../../hooks/useSubmitRequest';
import { api } from '../../services/api';
import * as Haptics from 'expo-haptics';

jest.mock('../../services/api', () => ({
    api: {
        createRequest: jest.fn(),
    }
}));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium' },
    NotificationFeedbackType: { Success: 'Success' },
}));
jest.mock('../../utils/logger');
jest.mock('../../utils/errorHandler');

describe('useSubmitRequest', () => {
    const mockT = jest.fn((key) => key);
    const mockToast = { error: jest.fn(), success: jest.fn() };
    const mockNavigation = { navigate: jest.fn(), replace: jest.fn() };

    // Mock Alert.alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => { });

    beforeEach(() => {
        jest.clearAllMocks();
        global.FormData = jest.fn(() => ({
            append: jest.fn(),
        })) as any;
    });

    const baseParams = {
        selectedVehicle: {
            car_make: 'Toyota',
            car_model: 'Camry',
            car_year: 2020,
            vin_number: '1FATP42P4X1234567',
        },
        partDescription: 'Brake pads',
        quantity: 1,
        side: 'na',
        partCategory: 'Engine',
        partSubCategory: 'Valves',
        partNumber: 'OEM-12345',
        condition: 'new',
        deliveryLocation: { lat: 25.2, lng: 51.5, address: 'Doha' },
        images: ['file://image1.jpg'],
        carFrontImage: 'file://front.jpg',
        carRearImage: 'file://rear.jpg',
        t: mockT,
        toast: mockToast,
        navigation: mockNavigation,
    };

    it('should show error if vehicle is not selected', async () => {
        const { result } = renderHook(() =>
            useSubmitRequest({ ...baseParams, selectedVehicle: null })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockToast.error).toHaveBeenCalledWith('newRequest.missingVehicle', 'newRequest.pleaseSelectVehicle');
        expect(api.createRequest).not.toHaveBeenCalled();
    });

    it('should show VIN alert if selected vehicle is missing VIN', async () => {
        const noVinVehicle = { car_make: 'Toyota', car_model: 'Camry', car_year: 2020, vin_number: null };
        const { result } = renderHook(() =>
            useSubmitRequest({ ...baseParams, selectedVehicle: noVinVehicle })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(Alert.alert).toHaveBeenCalledWith(
            'newRequest.vinRequired',
            'newRequest.vinRequiredMessage',
            expect.any(Array)
        );
        expect(api.createRequest).not.toHaveBeenCalled();
    });

    it('should show error if part description is missing/empty', async () => {
        const { result } = renderHook(() =>
            useSubmitRequest({ ...baseParams, partDescription: '   ' }) // Empty string
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockToast.error).toHaveBeenCalledWith('newRequest.missingDescription', 'newRequest.pleaseDescribePart');
        expect(api.createRequest).not.toHaveBeenCalled();
    });

    it('should successfully submit form and correctly format description', async () => {
        const mockAppend = jest.fn();
        global.FormData = jest.fn(() => ({
            append: mockAppend,
        })) as any;

        (api.createRequest as jest.Mock).mockResolvedValue({ request_id: 'REQ-10001' });

        const { result } = renderHook(() =>
            useSubmitRequest({
                ...baseParams,
                quantity: 4,
                side: 'left', // This tests the logic for injecting side and quantity into the description
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
        expect(mockAppend).toHaveBeenCalledWith('car_make', 'Toyota');
        expect(mockAppend).toHaveBeenCalledWith('vin_number', '1FATP42P4X1234567');
        expect(mockAppend).toHaveBeenCalledWith('condition_required', 'new');

        // Assert modified finalDescription
        expect(mockAppend).toHaveBeenCalledWith(
            'part_description',
            "Brake pads\n\nnewRequest.quantity: 4 newRequest.pcs\nnewRequest.position: newRequest.leftDriver"
        );

        // Assert file handling 
        expect(mockAppend).toHaveBeenCalledWith('images', {
            uri: 'file://image1.jpg',
            name: 'part_0.jpg',
            type: 'image/jpg',
        });

        expect(api.createRequest).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith('newRequest.requestCreated', 'newRequest.garagesReviewing');
        expect(mockNavigation.replace).toHaveBeenCalledWith('RequestDetail', { requestId: 'REQ-10001' });
        expect(result.current.isSubmitting).toBe(false); // Reset state
    });

    it('should set isSubmitting to true while running and handle API errors', async () => {
        (api.createRequest as jest.Mock).mockImplementation(() => {
            return new Promise((_, reject) => setTimeout(() => reject(new Error('API Error')), 100));
        });

        const { result } = renderHook(() =>
            useSubmitRequest(baseParams)
        );

        // Run submit asynchronously
        let promise;
        act(() => {
            promise = result.current.handleSubmit();
        });

        expect(result.current.isSubmitting).toBe(true);

        await act(async () => {
            await promise;
        });

        expect(result.current.isSubmitting).toBe(false);
        // Error handler should've been called (mocked, but we just verify it didn't throw uncaught errors)
    });
});
