/**
 * Request Service
 * 
 * Centralized business logic for part requests.
 * Extracted from request.controller.ts
 */

import pool from '../config/db';
import { vinService } from './vin.service';
import { createBatchNotifications } from './notification.service';
import { autoSaveVehicle } from '../controllers/vehicle.controller';
import fs from 'fs/promises';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

// ============================================
// TYPES
// ============================================

export interface CreateRequestParams {
    userId: string;
    carMake: string;
    carModel: string;
    carYear: unknown;
    vinNumber?: string;
    partDescription: string;
    partNumber?: string;
    partCategory?: string;
    partSubcategory?: string;
    conditionRequired?: string;
    deliveryAddressText?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    files?: { [fieldname: string]: Express.Multer.File[] };
}

export interface RequestResult {
    request: any;
    message: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================

const validateCarYear = (year: unknown): { valid: boolean; value: number; message?: string } => {
    const currentYear = new Date().getFullYear();
    const numYear = parseInt(String(year), 10);

    if (isNaN(numYear)) {
        return { valid: false, value: 0, message: 'Car year must be a number' };
    }
    if (numYear < 1900) {
        return { valid: false, value: 0, message: 'Car year must be 1900 or later' };
    }
    if (numYear > currentYear + 2) {
        return { valid: false, value: 0, message: `Car year cannot be more than ${currentYear + 2}` };
    }
    return { valid: true, value: numYear };
};

const validateVIN = (vin: string | undefined): { valid: boolean; message?: string } => {
    if (!vin || vin.trim() === '') {
        return { valid: true }; // VIN is optional
    }
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
        return { valid: false, message: 'VIN number must be exactly 17 characters' };
    }
    // Basic VIN format check (alphanumeric, no I, O, Q)
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
        return { valid: false, message: 'Invalid VIN format' };
    }
    return { valid: true };
};

const validateConditionRequired = (condition: string | undefined): { valid: boolean; message?: string } => {
    const validConditions = ['new', 'used', 'any'];
    const cond = (condition || 'any').toLowerCase();

    if (!validConditions.includes(cond)) {
        return { valid: false, message: `Condition must be one of: ${validConditions.join(', ')}` };
    }
    return { valid: true };
};

const validateStringLength = (value: string, fieldName: string, maxLength: number): { valid: boolean; message?: string } => {
    if (value && value.length > maxLength) {
        return { valid: false, message: `${fieldName} cannot exceed ${maxLength} characters` };
    }
    return { valid: true };
};

// ============================================
// SERVICE METHODS
// ============================================

export async function createRequest(params: CreateRequestParams): Promise<RequestResult> {
    let {
        userId,
        carMake,
        carModel,
        carYear,
        vinNumber,
        partDescription,
        partNumber,
        partCategory,
        partSubcategory,
        conditionRequired,
        deliveryAddressText,
        deliveryLat,
        deliveryLng,
        files
    } = params;

    // 1. Auto-Decode VIN if provided
    if (vinNumber) {
        const decoded = vinService.decodeVIN(vinNumber);
        if (decoded) {
            if (!carMake) {carMake = decoded.make;}
            if (!carYear && decoded.year) {carYear = decoded.year;}
        }
    }

    // 2. Validation
    if (!carMake || !carModel || !carYear || !partDescription) {
        throw new Error('Missing required fields: car_make, car_model, car_year, part_description');
    }

    const yearCheck = validateCarYear(carYear);
    if (!yearCheck.valid) {throw new Error(yearCheck.message);}

    const vinCheck = validateVIN(vinNumber);
    if (!vinCheck.valid) {throw new Error(vinCheck.message);}

    const conditionCheck = validateConditionRequired(conditionRequired);
    if (!conditionCheck.valid) {throw new Error(conditionCheck.message);}

    const descCheck = validateStringLength(partDescription, 'Part description', 1000);
    if (!descCheck.valid) {throw new Error(descCheck.message);}

    const makeCheck = validateStringLength(carMake, 'Car make', 100);
    if (!makeCheck.valid) {throw new Error(makeCheck.message);}

    const modelCheck = validateStringLength(carModel, 'Car model', 100);
    if (!modelCheck.valid) {throw new Error(modelCheck.message);}

    // File Handling - Part Photos
    const partImages = (files?.['images'] || []).filter(f => f && f.path);
    const imageUrls = partImages.map(f => `/${  f.path.replace(/\\/g, '/')}`);

    // Vehicle ID Photos (for Qatar scrap garages)
    const carFrontImageFile = files?.['car_front_image']?.[0];
    const carRearImageFile = files?.['car_rear_image']?.[0];
    const carFrontImageUrl = carFrontImageFile?.path ? `/${  carFrontImageFile.path.replace(/\\/g, '/')}` : null;
    const carRearImageUrl = carRearImageFile?.path ? `/${  carRearImageFile.path.replace(/\\/g, '/')}` : null;



    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 4. Insert Request
        const result = await client.query(
            `INSERT INTO part_requests
       (customer_id, car_make, car_model, car_year, vin_number, part_description, part_number, part_category, part_subcategory, condition_required, image_urls, delivery_address_text, delivery_lat, delivery_lng, car_front_image_url, car_rear_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING request_id, created_at`,
            [userId, carMake, carModel, yearCheck.value, vinNumber || null, partDescription, partNumber || null, partCategory || null, partSubcategory || null, conditionRequired || 'any', imageUrls, deliveryAddressText, deliveryLat || null, deliveryLng || null, carFrontImageUrl, carRearImageUrl]
        );

        const request = result.rows[0];
        await client.query('COMMIT');

        // 5. Notifications
        notifyRelevantGarages(
            request,
            carMake,
            carModel,
            yearCheck.value,
            partDescription,
            conditionRequired || 'any',
            imageUrls,
            deliveryAddressText || null,
            vinNumber || null,
            partNumber || null,
            partCategory || null,
            partSubcategory || null
        );

        // 6. Auto-Save Vehicle
        try {
            await autoSaveVehicle(
                userId,
                carMake,
                carModel,
                yearCheck.value,
                vinNumber || undefined,
                carFrontImageUrl || undefined,
                carRearImageUrl || undefined
            );
        } catch (autoSaveErr) {
            logger.error('Vehicle auto-save failed', { error: autoSaveErr });
        }

        return {
            request,
            message: 'Request created'
        };

    } catch (err) {
        await client.query('ROLLBACK');

        // Cleanup uploaded files on error
        const allFiles = [
            ...(files?.['images'] || []),
            ...(files?.['car_front_image'] || []),
            ...(files?.['car_rear_image'] || [])
        ];
        for (const file of allFiles) {
            try {
                await fs.unlink(file.path);
            } catch (e) { logger.error('File cleanup failed', { error: e }); }
        }

        throw err;
    } finally {
        client.release();
    }
}

async function notifyRelevantGarages(
    request: any,
    carMake: string,
    carModel: string,
    carYear: number,
    partDescription: string,
    conditionRequired: string,
    imageUrls: string[],
    deliveryAddressText: string | null,
    vinNumber: string | null,
    partNumber: string | null,
    partCategory: string | null,
    partSubcategory: string | null
) {
    try {
        let conditionFilter = "1=1";
        if (conditionRequired === 'new') {conditionFilter = "supplier_type IN ('new', 'both')";}
        else if (conditionRequired === 'used') {conditionFilter = "supplier_type IN ('used', 'both')";}

        const targetGaragesResult = await pool.query(`
            SELECT garage_id, specialized_brands, all_brands 
            FROM garages 
            WHERE deleted_at IS NULL 
            AND (approval_status = 'approved' OR approval_status = 'demo')
            AND (${conditionFilter})
        `);

        const notificationsToCreate: any[] = [];
        const io = getIO();

        // Use for...of to support async/await
        for (const garage of targetGaragesResult.rows) {
            let matchesBrand = false;
            const hasSpecialization = garage.specialized_brands && Array.isArray(garage.specialized_brands) && garage.specialized_brands.length > 0;

            if (garage.all_brands) {
                matchesBrand = true;
            } else if (hasSpecialization) {
                const brands = garage.specialized_brands.map((b: string) => b.toLowerCase());
                if (brands.includes(carMake.toLowerCase())) {
                    matchesBrand = true;
                }
            } else {
                matchesBrand = true;
            }

            if (matchesBrand) {
                // Send push notification to garage
                try {
                    const { pushService } = await import('./push.service');
                    await pushService.sendToUser(
                        garage.garage_id,
                        '🚗 New Request Available!',
                        `${carYear} ${carMake} ${carModel} - ${partDescription.substring(0, 40)}`,
                        {
                            type: 'new_request',
                            requestId: request.request_id,
                            carMake,
                            carModel,
                            carYear,
                        },
                        { channelId: 'default', sound: true }
                    );
                } catch (pushErr) {
                    logger.error('Push notification failed', { error: pushErr });
                }

                // Emit Live Request
                if (io) {
                    io.to(`garage_${garage.garage_id}`).emit('new_request', {
                        request_id: request.request_id,
                        car_make: carMake,
                        car_model: carModel,
                        car_year: carYear,
                        vin_number: vinNumber,
                        part_description: partDescription,
                        part_number: partNumber,
                        part_category: partCategory,
                        part_subcategory: partSubcategory,
                        condition_required: conditionRequired,
                        image_urls: imageUrls,
                        delivery_address_text: deliveryAddressText,
                        status: 'active',
                        created_at: request.created_at,
                        bid_count: 0
                    });
                }

                // Prepare Notification
                notificationsToCreate.push({
                    userId: garage.garage_id,
                    type: 'new_request',
                    title: 'New Request Matching Your Profile 🚗',
                    message: `${carYear} ${carMake} ${carModel}: ${partDescription.substring(0, 50)}${partDescription.length > 50 ? '...' : ''}`,
                    data: { request_id: request.request_id, car_make: carMake, car_model: carModel, car_year: carYear },
                    target_role: 'garage'
                });
            }
        }

        if (notificationsToCreate.length > 0) {
            await createBatchNotifications(notificationsToCreate);
        }

    } catch (socketErr) {
        logger.error('Notification logic failed', { error: socketErr });
    }
}
