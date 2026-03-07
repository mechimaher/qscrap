import { useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

interface SubmitParams {
    selectedVehicle: any;
    partDescription: string;
    quantity: number;
    side: string;
    partCategory: string;
    partSubCategory: string;
    partNumber: string;
    condition: string;
    deliveryLocation: { lat: number | null; lng: number | null; address: string };
    images: string[];
    carFrontImage: string | null;
    carRearImage: string | null;
    t: any;
    toast: any;
    navigation: any;
}

export function useSubmitRequest({
    selectedVehicle,
    partDescription,
    quantity,
    side,
    partCategory,
    partSubCategory,
    partNumber,
    condition,
    deliveryLocation,
    images,
    carFrontImage,
    carRearImage,
    t,
    toast,
    navigation,
}: SubmitParams) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (isSubmitting) return;

        if (!selectedVehicle) {
            toast.error(t('newRequest.missingVehicle'), t('newRequest.pleaseSelectVehicle'));
            return;
        }

        if (!selectedVehicle.vin_number) {
            Alert.alert(
                t('newRequest.vinRequired'),
                t('newRequest.vinRequiredMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('newRequest.addVin'),
                        onPress: () => navigation.navigate('MyVehicles'),
                        style: 'default'
                    }
                ]
            );
            return;
        }

        if (!partDescription.trim()) {
            toast.error(t('newRequest.missingDescription'), t('newRequest.pleaseDescribePart'));
            return;
        }

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const formData = new FormData();

            formData.append('car_make', selectedVehicle.car_make);
            formData.append('car_model', selectedVehicle.car_model);
            formData.append('car_year', selectedVehicle.car_year.toString());
            if (selectedVehicle.vin_number) {
                formData.append('vin_number', selectedVehicle.vin_number);
            }

            let finalDescription = partDescription.trim();
            if (quantity > 1) {
                finalDescription += `\n\n${t('newRequest.quantity')}: ${quantity} ${t('newRequest.pcs')}`;
            }
            if (side !== 'na') {
                const sideLabels: Record<string, string> = {
                    left: t('newRequest.leftDriver'),
                    right: t('newRequest.rightPassenger'),
                    both: t('newRequest.bothSides')
                };
                finalDescription += `\n${t('newRequest.position')}: ${sideLabels[side]}`;
            }

                formData.append('part_description', finalDescription);
            if (partCategory) formData.append('part_category', partCategory);
            if (partSubCategory) formData.append('part_subcategory', partSubCategory);
            if (partNumber.trim()) formData.append('part_number', partNumber.trim());
            formData.append('condition_required', condition);

            if (deliveryLocation.lat && deliveryLocation.lng) {
                formData.append('delivery_lat', deliveryLocation.lat.toString());
                formData.append('delivery_lng', deliveryLocation.lng.toString());
                formData.append('delivery_address_text', deliveryLocation.address);
            }

            images.forEach((uri, index) => {
                const uriParts = uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('images', {
                    uri,
                    name: `part_${index}.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            });

            if (carFrontImage) {
                const frontParts = carFrontImage.split('.');
                const frontType = frontParts[frontParts.length - 1];
                formData.append('car_front_image', {
                    uri: carFrontImage,
                    name: `car_front.${frontType}`,
                    type: `image/${frontType}`,
                } as any);
            }

            if (carRearImage) {
                const rearParts = carRearImage.split('.');
                const rearType = rearParts[rearParts.length - 1];
                formData.append('car_rear_image', {
                    uri: carRearImage,
                    name: `car_rear.${rearType}`,
                    type: `image/${rearType}`,
                } as any);
            }

            const response = await api.createRequest(formData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.success(t('newRequest.requestCreated'), t('newRequest.garagesReviewing'));

            navigation.replace('RequestDetail', { requestId: response.request_id });

        } catch (error: any) {
            logError('[NewRequest] Submit error:', error);
            handleApiError(error, toast);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        isSubmitting,
        handleSubmit,
    };
}
