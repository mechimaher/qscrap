/**
 * QuickServiceService - Core Business Logic
 * Handles assignment, lifecycle, and provider matching for Quick Services
 */

import { Pool } from 'pg';
import { Server as SocketServer } from 'socket.io';
import {
    QuickServiceType,
    QuickServiceStatus,
    CreateRequestDto,
    AssignmentResult,
    GarageWithDistance,
    VALID_SERVICE_TYPES
} from './types';

export class QuickServiceService {
    constructor(
        private pool: Pool,
        private io: SocketServer
    ) { }

    /**
     * Haversine formula to calculate distance between two GPS coordinates
     * Returns distance in kilometers
     */
    static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Validate service type
     */
    static isValidServiceType(type: string): type is QuickServiceType {
        return VALID_SERVICE_TYPES.includes(type as QuickServiceType);
    }

    /**
     * Find and assign nearest capable garage
     */
    async assignQuickService(
        requestId: string,
        serviceType: string,
        lat: number,
        lng: number,
        excludeGarages: string[] = []
    ): Promise<AssignmentResult> {
        try {
            // Find garages with quick service capability
            const garagesQuery = await this.pool.query(`
                SELECT 
                    g.garage_id,
                    g.garage_name,
                    g.phone_number,
                    g.location_lat,
                    g.location_lng,
                    gs.mobile_service_radius_km
                FROM garages g
                JOIN garage_settings gs ON g.garage_id = gs.garage_id
                WHERE 
                    g.approval_status = 'approved'
                    AND gs.provides_quick_services = true
                    AND $1 = ANY(gs.quick_services_offered)
                    AND g.location_lat IS NOT NULL
                    AND g.location_lng IS NOT NULL
                    ${excludeGarages.length > 0 ? 'AND g.garage_id != ALL($2::uuid[])' : ''}
            `, excludeGarages.length > 0 ? [serviceType, excludeGarages] : [serviceType]);

            if (garagesQuery.rows.length === 0) {
                console.log('[QuickService] No garages found for', serviceType);
                return { success: false, error: 'No service providers available in your area' };
            }

            // Calculate distances and filter by radius
            const garagesWithDistance: GarageWithDistance[] = garagesQuery.rows
                .map(g => ({
                    ...g,
                    distance_km: QuickServiceService.haversineDistance(
                        lat, lng,
                        parseFloat(g.location_lat),
                        parseFloat(g.location_lng)
                    )
                }))
                .filter(g => g.distance_km <= (g.mobile_service_radius_km || 50))
                .sort((a, b) => a.distance_km - b.distance_km);

            if (garagesWithDistance.length === 0) {
                console.log('[QuickService] No garages within service radius for', serviceType);
                return { success: false, error: 'No service providers available in your area' };
            }

            // Assign to closest garage
            const assignedGarage = garagesWithDistance[0];

            await this.pool.query(`
                UPDATE quick_service_requests
                SET 
                    assigned_garage_id = $1,
                    status = 'assigned',
                    assigned_at = NOW()
                WHERE request_id = $2
            `, [assignedGarage.garage_id, requestId]);

            // Get request details for notification
            const requestDetails = await this.pool.query(`
                SELECT 
                    qsr.*,
                    u.full_name as customer_name,
                    u.phone_number as customer_phone
                FROM quick_service_requests qsr
                JOIN users u ON qsr.customer_id = u.user_id
                WHERE qsr.request_id = $1
            `, [requestId]);

            const request = requestDetails.rows[0];

            // Send WebSocket notification to garage
            this.io.to(`garage_${assignedGarage.garage_id}`).emit('new_quick_service', {
                request_id: requestId,
                service_type: serviceType,
                customer_name: request.customer_name,
                customer_phone: request.customer_phone,
                vehicle: `${request.vehicle_make} ${request.vehicle_model} ${request.vehicle_year}`,
                location: {
                    address: request.location_address,
                    lat: request.location_lat,
                    lng: request.location_lng
                },
                distance_km: assignedGarage.distance_km.toFixed(1),
                notes: request.notes,
                created_at: request.created_at
            });

            console.log(`[QuickService] Assigned ${requestId} to garage ${assignedGarage.garage_id} (${assignedGarage.distance_km.toFixed(1)}km away)`);

            return {
                success: true,
                garage: {
                    garage_id: assignedGarage.garage_id,
                    name: assignedGarage.garage_name,
                    distance_km: assignedGarage.distance_km
                }
            };
        } catch (error) {
            console.error('[QuickService] Assignment error:', error);
            return { success: false, error: 'Failed to assign service provider' };
        }
    }

    /**
     * Create a new quick service request
     */
    async createRequest(
        customerId: string,
        dto: CreateRequestDto
    ): Promise<{ request_id: string; status: QuickServiceStatus; assignment: AssignmentResult }> {
        // Validate service type
        if (!QuickServiceService.isValidServiceType(dto.service_type)) {
            throw new Error('Invalid service type');
        }

        // Check for duplicate active request
        const duplicateCheck = await this.pool.query(`
            SELECT request_id FROM quick_service_requests
            WHERE customer_id = $1
              AND service_type = $2
              AND vehicle_make = $3
              AND vehicle_model = $4
              AND vehicle_year = $5
              AND status IN ('pending', 'assigned', 'quoted', 'accepted', 'in_progress')
            LIMIT 1
        `, [customerId, dto.service_type, dto.vehicle_make, dto.vehicle_model, dto.vehicle_year]);

        if (duplicateCheck.rows.length > 0) {
            throw new Error(`You already have an active ${dto.service_type} service request for this vehicle`);
        }

        // Create request
        const result = await this.pool.query(`
            INSERT INTO quick_service_requests (
                customer_id, service_type, location_lat, location_lng,
                location_address, vehicle_make, vehicle_model, vehicle_year,
                notes, payment_method, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            RETURNING request_id, created_at
        `, [
            customerId, dto.service_type, dto.location_lat, dto.location_lng,
            dto.location_address, dto.vehicle_make, dto.vehicle_model,
            dto.vehicle_year, dto.notes || null, dto.payment_method || 'cash'
        ]);

        const request = result.rows[0];

        // Immediately try to assign
        const assignment = await this.assignQuickService(
            request.request_id,
            dto.service_type,
            dto.location_lat,
            dto.location_lng
        );

        return {
            request_id: request.request_id,
            status: assignment.success ? 'assigned' : 'pending',
            assignment
        };
    }

    /**
     * Get customer's requests
     */
    async getCustomerRequests(customerId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT 
                qsr.*,
                g.garage_name,
                g.phone_number as garage_phone
            FROM quick_service_requests qsr
            LEFT JOIN garages g ON qsr.assigned_garage_id = g.garage_id
            WHERE qsr.customer_id = $1
            ORDER BY qsr.created_at DESC
            LIMIT 50
        `, [customerId]);

        return result.rows;
    }

    /**
     * Get garage's assigned requests
     */
    async getGarageRequests(garageId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT 
                qsr.*,
                u.full_name as customer_name,
                u.phone_number as customer_phone
            FROM quick_service_requests qsr
            JOIN users u ON qsr.customer_id = u.user_id
            WHERE qsr.assigned_garage_id = $1
            ORDER BY 
                CASE qsr.status
                    WHEN 'assigned' THEN 1
                    WHEN 'accepted' THEN 2
                    WHEN 'en_route' THEN 3
                    WHEN 'in_progress' THEN 4
                    ELSE 5
                END,
                qsr.created_at DESC
        `, [garageId]);

        return result.rows;
    }

    /**
     * Update request status with WebSocket notification
     */
    async updateStatus(
        requestId: string,
        garageId: string,
        newStatus: QuickServiceStatus,
        additionalData?: Record<string, any>
    ): Promise<{ customerId: string }> {
        const statusColumn = this.getTimestampColumn(newStatus);

        const query = statusColumn
            ? `UPDATE quick_service_requests SET status = $1, ${statusColumn} = NOW() WHERE request_id = $2 AND assigned_garage_id = $3 RETURNING customer_id`
            : `UPDATE quick_service_requests SET status = $1 WHERE request_id = $2 AND assigned_garage_id = $3 RETURNING customer_id`;

        const result = await this.pool.query(query, [newStatus, requestId, garageId]);

        if (result.rows.length === 0) {
            throw new Error('Request not found or not assigned to this garage');
        }

        const customerId = result.rows[0].customer_id;

        // Notify customer
        this.io.to(`user_${customerId}`).emit('service_update', {
            request_id: requestId,
            status: newStatus,
            ...additionalData
        });

        return { customerId };
    }

    private getTimestampColumn(status: QuickServiceStatus): string | null {
        const mapping: Record<string, string> = {
            'accepted': 'accepted_at',
            'en_route': 'dispatched_at',
            'in_progress': 'arrived_at',
            'completed': 'completed_at'
        };
        return mapping[status] || null;
    }

    /**
     * Complete a service request
     */
    async completeService(
        requestId: string,
        finalPrice: number,
        notes?: string
    ): Promise<void> {
        await this.pool.query(`
            UPDATE quick_service_requests
            SET 
                status = 'completed',
                final_price = $1,
                completion_notes = $2,
                completed_at = NOW()
            WHERE request_id = $3
        `, [finalPrice, notes, requestId]);
    }

    /**
     * Submit price quote
     */
    async submitQuote(
        requestId: string,
        garageId: string,
        quotedPrice: number,
        notes?: string
    ): Promise<void> {
        if (quotedPrice <= 0) {
            throw new Error('Valid price is required');
        }

        const requestCheck = await this.pool.query(`
            SELECT customer_id, assigned_garage_id, status
            FROM quick_service_requests WHERE request_id = $1
        `, [requestId]);

        if (requestCheck.rows.length === 0) {
            throw new Error('Request not found');
        }

        const request = requestCheck.rows[0];

        await this.pool.query(`
            UPDATE quick_service_requests SET
                quoted_price = $1,
                status = 'quoted',
                diagnostic_notes = COALESCE($2, diagnostic_notes)
            WHERE request_id = $3
        `, [quotedPrice, notes, requestId]);

        // Notify customer
        this.io.to(`user_${request.customer_id}`).emit('quote_received', {
            request_id: requestId,
            quoted_price: quotedPrice,
            notes
        });

        console.log(`[QuickService] Quote submitted for ${requestId}: ${quotedPrice} QAR`);
    }

    /**
     * Cancel a request
     */
    async cancelRequest(
        requestId: string,
        customerId: string
    ): Promise<{ garageId?: string }> {
        const result = await this.pool.query(`
            UPDATE quick_service_requests
            SET status = 'cancelled'
            WHERE request_id = $1 
              AND customer_id = $2
              AND status NOT IN ('completed', 'in_progress')
            RETURNING assigned_garage_id
        `, [requestId, customerId]);

        if (result.rows.length === 0) {
            throw new Error('Cannot cancel - request not found or already in progress');
        }

        const garageId = result.rows[0].assigned_garage_id;

        if (garageId) {
            this.io.to(`garage_${garageId}`).emit('service_cancelled', {
                request_id: requestId
            });
        }

        return { garageId };
    }
}
