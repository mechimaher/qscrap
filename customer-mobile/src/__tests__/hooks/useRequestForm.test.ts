import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRequestForm } from '../../hooks/useRequestForm';

jest.mock('../../constants/categoryData', () => ({
    PART_SUBCATEGORIES: {
        'Engine': ['Pistons', 'Valves'],
        'Transmission': ['Gears', 'Clutch'],
    }
}));

describe('useRequestForm', () => {
    const mockT = jest.fn((key) => key);
    const mockToast = { info: jest.fn(), error: jest.fn(), success: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useRequestForm({ t: mockT, toast: mockToast }));

        expect(result.current.selectedVehicle).toBeNull();
        expect(result.current.partCategory).toBe('');
        expect(result.current.partSubCategory).toBe('');
        expect(result.current.partDescription).toBe('');
        expect(result.current.partNumber).toBe('');
        expect(result.current.condition).toBe('any');
        expect(result.current.quantity).toBe(1);
        expect(result.current.side).toBe('na');
        expect(result.current.deliveryLocation).toEqual({ lat: null, lng: null, address: '' });
        expect(result.current.availableSubCategories).toEqual([]);
    });

    it('should prefill data when provided', async () => {
        const prefillData = {
            partDescription: 'Brake pads',
            partCategory: 'Engine', // Testing with Engine to trigger subcategories
            partSubCategory: 'Valves',
        };

        const { result } = renderHook(() =>
            useRequestForm({ prefillData, t: mockT, toast: mockToast })
        );

        expect(result.current.partDescription).toBe('Brake pads');
        expect(result.current.partCategory).toBe('Engine');

        act(() => {
            jest.advanceTimersByTime(150); // Subcategory timeout is 100ms
        });

        await waitFor(() => {
            expect(result.current.partSubCategory).toBe('Valves');
            // Check available subcategories triggered by partCategory change
            expect(result.current.availableSubCategories).toEqual(['Pistons', 'Valves']);
        });

        act(() => {
            jest.advanceTimersByTime(400); // Toast timeout is 500ms
        });

        expect(mockToast.info).toHaveBeenCalledWith('newRequest.orderAgain', 'newRequest.prefilledMsg');
    });

    it('should initialize delivery location', () => {
        const initialDeliveryLocation = { lat: 25.2, lng: 51.5, address: 'Doha' };

        const { result } = renderHook(() =>
            useRequestForm({ initialDeliveryLocation, t: mockT, toast: mockToast })
        );

        expect(result.current.deliveryLocation).toEqual(initialDeliveryLocation);
    });

    it('should automatically select first vehicle if no prefill data matches', () => {
        const { result } = renderHook(() => useRequestForm({ t: mockT, toast: mockToast }));

        const vehicles = [
            { id: 1, car_make: 'Toyota', car_model: 'Camry', car_year: 2020 },
            { id: 2, car_make: 'Honda', car_model: 'Civic', car_year: 2021 },
        ];

        act(() => {
            result.current.handleVehiclesLoaded(vehicles);
        });

        expect(result.current.selectedVehicle).toEqual(vehicles[0]);
    });

    it('should automatically select matching vehicle based on prefill data', () => {
        const prefillData = {
            carMake: 'Honda',
            carModel: 'civic', // test case-insensitivity
            carYear: 2021,
        };

        const { result } = renderHook(() =>
            useRequestForm({ prefillData, t: mockT, toast: mockToast })
        );

        const vehicles = [
            { id: 1, car_make: 'Toyota', car_model: 'Camry', car_year: 2020 },
            { id: 2, car_make: 'Honda', car_model: 'Civic', car_year: 2021 },
        ];

        act(() => {
            result.current.handleVehiclesLoaded(vehicles);
        });

        expect(result.current.selectedVehicle).toEqual(vehicles[1]);
    });

    it('should update available subcategories when category changes', () => {
        const { result } = renderHook(() => useRequestForm({ t: mockT, toast: mockToast }));

        act(() => {
            result.current.setPartCategory('Transmission');
        });

        expect(result.current.availableSubCategories).toEqual(['Gears', 'Clutch']);
        expect(result.current.partSubCategory).toBe(''); // Automatically resets subcategory

        act(() => {
            result.current.setPartCategory('UnknownCategory');
        });

        expect(result.current.availableSubCategories).toEqual([]);
    });

    it('should allow manual state updates', () => {
        const { result } = renderHook(() => useRequestForm({ t: mockT, toast: mockToast }));

        act(() => {
            result.current.setQuantity(4);
            result.current.setSide('left');
            result.current.setCondition('new');
        });

        expect(result.current.quantity).toBe(4);
        expect(result.current.side).toBe('left');
        expect(result.current.condition).toBe('new');
    });
});
