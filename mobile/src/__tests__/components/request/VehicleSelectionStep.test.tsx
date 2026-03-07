/**
 * VehicleSelectionStep Component Test
 * Tests the vehicle selection wizard step with MyVehiclesSelector integration
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import VehicleSelectionStep from '../../../components/request/VehicleSelectionStep';

// Mock MyVehiclesSelector
jest.mock('../../../components/MyVehiclesSelector', () => {
    return function MockMyVehiclesSelector({ onSelect, selectedVehicleId, onVehiclesLoaded }: any) {
        return (
            <div testID="my-vehicles-selector">
                <button onClick={() => onSelect({ vehicle_id: 'v1', car_make: 'Toyota', car_model: 'Camry', car_year: 2024 })}>
                    Select Vehicle
                </button>
                <button onClick={() => onVehiclesLoaded([{ vehicle_id: 'v1', car_make: 'Toyota', car_model: 'Camry', car_year: 2024 }])}>
                    Load Vehicles
                </button>
                {selectedVehicleId && <span data-testid="selected-id">{selectedVehicleId}</span>}
            </div>
        );
    };
});

describe('VehicleSelectionStep', () => {
    const defaultProps = {
        colors: {
            surface: '#FFFFFF',
            text: '#1F2937',
            textSecondary: '#6B7280',
        },
        t: (key: string) => {
            const translations: Record<string, string> = {
                'newRequest.selectVehicle': 'Select Vehicle',
                'newRequest.chooseFromCars': 'Choose from your saved vehicles',
                'newRequest.vinVerified': 'VIN {{vin}} verified',
            };
            return translations[key] || key;
        },
        isRTL: false,
        rtlFlexDirection: (isRTL: boolean) => isRTL ? 'row-reverse' : 'row',
        rtlTextAlign: (isRTL: boolean) => isRTL ? 'right' : 'left',
        selectedVehicle: null,
        handleVehicleSelect: jest.fn(),
        handleVehiclesLoaded: jest.fn(),
        navigation: { navigate: jest.fn() },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render step header with title', () => {
        render(<VehicleSelectionStep {...defaultProps} />);
        
        expect(screen.getByText('Select Vehicle')).toBeTruthy();
    });

    it('should render step subtitle', () => {
        render(<VehicleSelectionStep {...defaultProps} />);
        
        expect(screen.getByText('Choose from your saved vehicles')).toBeTruthy();
    });

    it('should display step number badge', () => {
        render(<VehicleSelectionStep {...defaultProps} />);
        
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('should render MyVehiclesSelector component', () => {
        render(<VehicleSelectionStep {...defaultProps} />);
        
        expect(screen.getByTestId('my-vehicles-selector')).toBeTruthy();
    });

    it('should call handleVehicleSelect when vehicle is selected', () => {
        const handleVehicleSelectMock = jest.fn();
        render(<VehicleSelectionStep {...defaultProps} handleVehicleSelect={handleVehicleSelectMock} />);
        
        const selectButton = screen.getByText('Select Vehicle');
        fireEvent.click(selectButton);
        
        expect(handleVehicleSelectMock).toHaveBeenCalledWith({
            vehicle_id: 'v1',
            car_make: 'Toyota',
            car_model: 'Camry',
            car_year: 2024,
        });
    });

    it('should call handleVehiclesLoaded when vehicles are loaded', () => {
        const handleVehiclesLoadedMock = jest.fn();
        render(<VehicleSelectionStep {...defaultProps} handleVehiclesLoaded={handleVehiclesLoadedMock} />);
        
        const loadButton = screen.getByText('Load Vehicles');
        fireEvent.click(loadButton);
        
        expect(handleVehiclesLoadedMock).toHaveBeenCalledWith([
            { vehicle_id: 'v1', car_make: 'Toyota', car_model: 'Camry', car_year: 2024 },
        ]);
    });

    it('should display selected vehicle badge when vehicle is selected', () => {
        const selectedVehicle = {
            vehicle_id: 'v1',
            car_make: 'Toyota',
            car_model: 'Camry',
            car_year: 2024,
        };
        render(<VehicleSelectionStep {...defaultProps} selectedVehicle={selectedVehicle} />);
        
        expect(screen.getByText('Toyota Camry (2024)')).toBeTruthy();
    });

    it('should display VIN verified text when vehicle has VIN', () => {
        const selectedVehicle = {
            vehicle_id: 'v1',
            car_make: 'Toyota',
            car_model: 'Camry',
            car_year: 2024,
            vin_number: '1234567890',
        };
        render(<VehicleSelectionStep {...defaultProps} selectedVehicle={selectedVehicle} />);
        
        expect(screen.getByText('VIN 1234567890 verified')).toBeTruthy();
    });

    it('should not display VIN text when vehicle has no VIN', () => {
        const selectedVehicle = {
            vehicle_id: 'v1',
            car_make: 'Toyota',
            car_model: 'Camry',
            car_year: 2024,
        };
        render(<VehicleSelectionStep {...defaultProps} selectedVehicle={selectedVehicle} />);
        
        expect(screen.queryByText('VIN verified')).toBeNull();
    });

    it('should support RTL layout', () => {
        const { rerender } = render(<VehicleSelectionStep {...defaultProps} isRTL={false} />);
        expect(screen.getByText('Select Vehicle')).toBeTruthy();
        
        rerender(<VehicleSelectionStep {...defaultProps} isRTL={true} />);
        expect(screen.getByText('Select Vehicle')).toBeTruthy();
    });

    it('should pass selectedVehicleId to MyVehiclesSelector', () => {
        const selectedVehicle = { vehicle_id: 'v1', car_make: 'Toyota', car_model: 'Camry', car_year: 2024 };
        render(<VehicleSelectionStep {...defaultProps} selectedVehicle={selectedVehicle} />);
        
        expect(screen.getByTestId('selected-id')).toHaveTextContent('v1');
    });
});
