/**
 * DeliveryFeeService - Centralized Delivery Fee Calculation
 * 
 * Features:
 * - Zone-based base fee calculation
 * - Order-value tier discounts
 * - Configurable tiers from database
 */

import { Pool } from 'pg';
import { GeoService, DeliveryFeeResult } from './geo.service';

export interface FeeTier {
    tier_id: number;
    min_order_value: number;
    max_order_value: number | null;
    discount_percent: number;
    description: string;
}

export interface DeliveryFeeCalculation {
    base_fee: number;
    discount_percent: number;
    discount_amount: number;
    final_fee: number;
    zone_name: string;
    zone_id: number | null;
    distance_km: number;
    is_free_delivery: boolean;
    tier_description: string;
    message: string;
}

export class DeliveryFeeService {
    private geoService: GeoService;

    constructor(private pool: Pool) {
        this.geoService = new GeoService(pool);
    }

    /**
     * Get all active fee tiers
     */
    async getFeeTiers(): Promise<FeeTier[]> {
        const result = await this.pool.query(`
            SELECT tier_id, min_order_value, max_order_value, discount_percent, description
            FROM delivery_fee_tiers
            WHERE is_active = true
            ORDER BY min_order_value ASC
        `);
        return result.rows;
    }

    /**
     * Find applicable tier for order value
     */
    async getTierForOrderValue(orderValue: number): Promise<FeeTier | null> {
        const result = await this.pool.query(`
            SELECT tier_id, min_order_value, max_order_value, discount_percent, description
            FROM delivery_fee_tiers
            WHERE is_active = true
            AND $1 >= min_order_value
            AND ($1 < max_order_value OR max_order_value IS NULL)
            ORDER BY min_order_value DESC
            LIMIT 1
        `, [orderValue]);

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Calculate delivery fee with order-value discounts
     * 
     * @param lat Delivery latitude
     * @param lng Delivery longitude
     * @param orderTotal Total order value (part price)
     */
    async calculateFee(
        lat: number,
        lng: number,
        orderTotal: number
    ): Promise<DeliveryFeeCalculation> {
        // Get zone-based fee
        const geoResult = await this.geoService.calculateDeliveryFee(lat, lng);
        const baseFee = geoResult.fee;

        // Get applicable tier for discount
        const tier = await this.getTierForOrderValue(orderTotal);
        const discountPercent = tier?.discount_percent || 0;
        const discountAmount = (baseFee * discountPercent) / 100;
        const finalFee = Math.max(0, baseFee - discountAmount);
        const isFreeDelivery = discountPercent === 100 || finalFee === 0;

        // Build message
        let message: string;
        if (isFreeDelivery) {
            message = 'FREE delivery for orders 1000+ QAR!';
        } else if (discountPercent > 0) {
            message = `${discountPercent}% off delivery for this order`;
        } else {
            message = 'Standard delivery fee';
        }

        return {
            base_fee: baseFee,
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            final_fee: parseFloat(finalFee.toFixed(2)),
            zone_name: geoResult.zone_name,
            zone_id: geoResult.zone_id,
            distance_km: geoResult.distance_km,
            is_free_delivery: isFreeDelivery,
            tier_description: tier?.description || 'Standard delivery',
            message
        };
    }

    /**
     * Calculate fee without GPS coordinates (uses default zone)
     * Useful for showing estimated fee before address is selected
     */
    async calculateEstimatedFee(orderTotal: number): Promise<{
        estimated_fee_range: { min: number; max: number };
        discount_percent: number;
        is_free_delivery: boolean;
        message: string;
    }> {
        // Get all zones to determine fee range
        const zones = await this.geoService.getDeliveryZones();
        const minZoneFee = Math.min(...zones.map(z => z.delivery_fee));
        const maxZoneFee = Math.max(...zones.map(z => z.delivery_fee));

        // Get applicable tier
        const tier = await this.getTierForOrderValue(orderTotal);
        const discountPercent = tier?.discount_percent || 0;

        // Apply discount to range
        const applyDiscount = (fee: number) =>
            Math.max(0, fee - (fee * discountPercent) / 100);

        const isFreeDelivery = discountPercent === 100;

        return {
            estimated_fee_range: {
                min: isFreeDelivery ? 0 : parseFloat(applyDiscount(minZoneFee).toFixed(2)),
                max: isFreeDelivery ? 0 : parseFloat(applyDiscount(maxZoneFee).toFixed(2))
            },
            discount_percent: discountPercent,
            is_free_delivery: isFreeDelivery,
            message: isFreeDelivery
                ? 'FREE delivery for orders 1000+ QAR!'
                : discountPercent > 0
                    ? `${discountPercent}% off delivery!`
                    : 'Delivery fee varies by location'
        };
    }

    /**
     * Check if delivery fee should be retained on refund
     * Returns the amount of delivery fee to retain
     */
    static calculateRetainedDeliveryFee(
        refundType: 'cancelled_before_dispatch' | 'customer_refusal' | 'wrong_part' | 'driver_failure',
        deliveryFee: number,
        driverAssigned: boolean
    ): number {
        // Full refund scenarios (including delivery fee)
        if (refundType === 'cancelled_before_dispatch' && !driverAssigned) {
            return 0; // No fee retained - order never dispatched
        }

        if (refundType === 'driver_failure') {
            return 0; // No fee retained - delivery failed on our end
        }

        // Retain delivery fee (customer caused the issue)
        if (refundType === 'customer_refusal' || refundType === 'wrong_part') {
            return deliveryFee;
        }

        // Default: if driver was assigned, retain the fee
        if (driverAssigned) {
            return deliveryFee;
        }

        return 0;
    }
}

export default DeliveryFeeService;
