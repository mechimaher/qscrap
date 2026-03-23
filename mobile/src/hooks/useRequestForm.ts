import { useState, useEffect } from 'react';
import { PART_SUBCATEGORIES } from '../constants/categoryData';

interface PrefillData {
    carMake?: string;
    carModel?: string;
    carYear?: number;
    partDescription?: string;
    partCategory?: string;
    partSubCategory?: string;
    imageUrls?: string[];
}

export function useRequestForm({ prefillData, initialDeliveryLocation, t, toast }: any) {
    const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

    const [partCategory, setPartCategory] = useState('');
    const [partSubCategory, setPartSubCategory] = useState('');
    const [partDescription, setPartDescription] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [condition, setCondition] = useState('any');
    const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);

    const [quantity, setQuantity] = useState<number>(1);
    const [side, setSide] = useState<'left' | 'right' | 'both' | 'na'>('na');

    const [deliveryLocation, setDeliveryLocation] = useState<{
        lat: number | null;
        lng: number | null;
        address: string;
    }>({ lat: null, lng: null, address: '' });

    useEffect(() => {
        if (!prefillData) return;

        if (prefillData.partDescription) {
            setPartDescription(prefillData.partDescription);
        }

        if (prefillData.partCategory) {
            setPartCategory(prefillData.partCategory);
        }

        if (prefillData.partSubCategory) {
            setTimeout(() => {
                setPartSubCategory(prefillData.partSubCategory!);
            }, 100);
        }

        if (prefillData.partDescription || prefillData.partCategory) {
            setTimeout(() => {
                toast.info(t('newRequest.orderAgain'), t('newRequest.prefilledMsg'));
            }, 500);
        }
    }, [prefillData, t, toast]);

    useEffect(() => {
        if (initialDeliveryLocation) {
            setDeliveryLocation({
                lat: initialDeliveryLocation.lat,
                lng: initialDeliveryLocation.lng,
                address: initialDeliveryLocation.address
            });
        }
    }, [initialDeliveryLocation]);

    const handleVehiclesLoaded = (vehicles: any[]) => {
        if (vehicles.length === 0) return;

        if (prefillData?.carMake) {
            const matchingVehicle = vehicles.find(
                (v: any) =>
                    v.car_make.toLowerCase() === prefillData.carMake?.toLowerCase() &&
                    v.car_model.toLowerCase() === prefillData.carModel?.toLowerCase() &&
                    v.car_year === prefillData.carYear
            );
            if (matchingVehicle) {
                setSelectedVehicle(matchingVehicle);
                return;
            }
        }
        setSelectedVehicle(vehicles[0]);
    };

    useEffect(() => {
        if (partCategory && PART_SUBCATEGORIES[partCategory]) {
            setAvailableSubCategories(PART_SUBCATEGORIES[partCategory]);
            setPartSubCategory('');
        } else {
            setAvailableSubCategories([]);
        }
    }, [partCategory]);

    return {
        selectedVehicle,
        setSelectedVehicle,
        handleVehiclesLoaded,
        partCategory,
        setPartCategory,
        partSubCategory,
        setPartSubCategory,
        availableSubCategories,
        partDescription,
        setPartDescription,
        partNumber,
        setPartNumber,
        condition,
        setCondition,
        quantity,
        setQuantity,
        side,
        setSide,
        deliveryLocation
    };
}
