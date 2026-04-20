/**
 * QScrap Fleet Delivery Pricing Service
 * 
 * Enterprise-grade delivery fee calculation compliant with Qatar Ministry of Commerce regulations.
 * Implements category-driven fleet assignment with vehicle-specific pricing.
 * 
 * @author QScrap Engineering Team
 * @version 2.0 - Qatar MOCI Compliant
 */

import { SystemConfig } from '../config/system.config';

// ============================================
// QATAR FLEET VEHICLE TYPES
// ============================================

export enum VehicleType {
    MOTORCYCLE = 'motorcycle',      // Small parts, documents
    SMALL_VAN = 'small_van',        // Medium parts (bumpers, doors)
    FLATBED_TRUCK = 'flatbed_truck' // Heavy parts (engines, transmissions)
}

// ============================================
// PART CATEGORIES TO VEHICLE MAPPING
// Based on Qatar MOCI cargo safety regulations
// ============================================

export const PartCategoryVehicleMap: Record<string, VehicleType> = {
    // Heavy Parts - Require Flatbed Truck
    'engine': VehicleType.FLATBED_TRUCK,
    'transmission': VehicleType.FLATBED_TRUCK,
    'chassis': VehicleType.FLATBED_TRUCK,
    'axle': VehicleType.FLATBED_TRUCK,
    'differential': VehicleType.FLATBED_TRUCK,
    'radiator': VehicleType.FLATBED_TRUCK,
    'exhaust_system': VehicleType.FLATBED_TRUCK,
    'fuel_tank': VehicleType.FLATBED_TRUCK,
    'suspension': VehicleType.FLATBED_TRUCK,
    
    // Medium Parts - Require Small Van
    'body_panel': VehicleType.SMALL_VAN,
    'door': VehicleType.SMALL_VAN,
    'hood': VehicleType.SMALL_VAN,
    'trunk_lid': VehicleType.SMALL_VAN,
    'bumper': VehicleType.SMALL_VAN,
    'fender': VehicleType.SMALL_VAN,
    'windshield': VehicleType.SMALL_VAN,
    'window': VehicleType.SMALL_VAN,
    'seat': VehicleType.SMALL_VAN,
    'dashboard': VehicleType.SMALL_VAN,
    'wheel': VehicleType.SMALL_VAN,
    'tire': VehicleType.SMALL_VAN,
    
    // Small Parts - Can use Motorcycle
    'mirror': VehicleType.MOTORCYCLE,
    'light': VehicleType.MOTORCYCLE,
    'headlight': VehicleType.MOTORCYCLE,
    'taillight': VehicleType.MOTORCYCLE,
    'sensor': VehicleType.MOTORCYCLE,
    'alternator': VehicleType.MOTORCYCLE,
    'starter': VehicleType.MOTORCYCLE,
    'water_pump': VehicleType.MOTORCYCLE,
    'oil_pump': VehicleType.MOTORCYCLE,
    'belt': VehicleType.MOTORCYCLE,
    'hose': VehicleType.MOTORCYCLE,
    'filter': VehicleType.MOTORCYCLE,
    'brake_pad': VehicleType.MOTORCYCLE,
    'brake_disc': VehicleType.MOTORCYCLE,
    'spark_plug': VehicleType.MOTORCYCLE,
    'battery': VehicleType.MOTORCYCLE,
    'key': VehicleType.MOTORCYCLE,
    'remote': VehicleType.MOTORCYCLE,
    'emblem': VehicleType.MOTORCYCLE,
    'handle': VehicleType.MOTORCYCLE,
    'switch': VehicleType.MOTORCYCLE,
    'relay': VehicleType.MOTORCYCLE,
    'fuse': VehicleType.MOTORCYCLE,
    'bulb': VehicleType.MOTORCYCLE
};

// ============================================
// QATAR PRICING CONFIGURATION (QAR)
// All fees rounded to whole QAR as per business requirement
// ============================================

export interface VehiclePricing {
    baseFare: number;        // Base pickup fee in QAR
    perKmRate: number;       // Rate per kilometer in QAR
    minFee: number;          // Minimum total fee in QAR
    maxFee?: number;         // Optional maximum fee cap
}

export const QatarVehiclePricing: Record<VehicleType, VehiclePricing> = {
    [VehicleType.MOTORCYCLE]: {
        baseFare: 5,           // 5 QAR base fare
        perKmRate: 1,          // 1 QAR/km
        minFee: 5              // Minimum 5 QAR
    },
    [VehicleType.SMALL_VAN]: {
        baseFare: 15,          // 15 QAR base fare
        perKmRate: 2,          // 2 QAR/km
        minFee: 15             // Minimum 15 QAR
    },
    [VehicleType.FLATBED_TRUCK]: {
        baseFare: 50,          // 50 QAR base fare
        perKmRate: 4,          // 4 QAR/km
        minFee: 50             // Minimum 50 QAR
    }
};

// ============================================
// QATAR ZONE Surcharges (MOCI Compliance)
// Additional fees for specific industrial/special zones
// ============================================

export const QatarZoneSurcharges: Record<string, number> = {
    'industrial_area': 10,     // Mesaieed Industrial Area
    'doha_port': 15,           // Doha Port (customs zone)
    'al_khor': 10,             // Northern Qatar (Al Khor)
    'dukhan': 15,              // Western Qatar (Dukhan)
    'salwa_border': 5,         // Salwa Road (border area)
    'airport_zone': 10         // Hamad International Airport cargo zone
};

// ============================================
// DELIVERY FEE CALCULATION SERVICE
// ============================================

export class FleetPricingService {
    
    /**
     * Determine required vehicle type based on part category
     * Falls back to SMALL_VAN if category unknown
     */
    static getRequiredVehicle(partCategory?: string): VehicleType {
        if (!partCategory) {
            return VehicleType.SMALL_VAN; // Default for unknown categories
        }
        
        const normalizedCategory = partCategory.toLowerCase().trim();
        return PartCategoryVehicleMap[normalizedCategory] || VehicleType.SMALL_VAN;
    }

    /**
     * Calculate delivery fee using Qatar-specific pricing
     * Formula: Fee = Base Fare + (Rate per KM × Distance) + Zone Surcharge
     * Result is rounded to whole QAR
     */
    static calculateDeliveryFee(
        distanceKm: number,
        vehicleType: VehicleType,
        zoneSurcharge?: number
    ): number {
        const pricing = QatarVehiclePricing[vehicleType];
        
        // Calculate raw fee
        let rawFee = pricing.baseFare + (pricing.perKmRate * distanceKm);
        
        // Add zone surcharge if applicable
        if (zoneSurcharge) {
            rawFee += zoneSurcharge;
        }
        
        // Ensure minimum fee
        if (rawFee < pricing.minFee) {
            rawFee = pricing.minFee;
        }
        
        // Round to whole QAR (standard rounding)
        const roundedFee = Math.round(rawFee);
        
        return roundedFee;
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * Fallback when Google Maps API is unavailable
     * Note: This is "as the crow flies" distance, not drivable distance
     */
    static calculateHaversineDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.max(0.5, distance); // Minimum 0.5 km to avoid zero fees
    }

    /**
     * Helper: Convert degrees to radians
     */
    private static toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get pricing breakdown for transparency (for UI display)
     */
    static getPricingBreakdown(
        distanceKm: number,
        vehicleType: VehicleType,
        zoneSurcharge?: number
    ): {
        baseFare: number;
        distanceFee: number;
        zoneSurcharge: number;
        totalFee: number;
        vehicleType: string;
        currency: string;
    } {
        const pricing = QatarVehiclePricing[vehicleType];
        const distanceFee = pricing.perKmRate * distanceKm;
        const surcharge = zoneSurcharge || 0;
        
        const rawTotal = pricing.baseFare + distanceFee + surcharge;
        const totalFee = Math.round(Math.max(rawTotal, pricing.minFee));
        
        return {
            baseFare: pricing.baseFare,
            distanceFee: Math.round(distanceFee),
            zoneSurcharge: Math.round(surcharge),
            totalFee,
            vehicleType,
            currency: 'QAR'
        };
    }

    /**
     * Validate coordinates are within Qatar bounds
     * Qatar bounding box: 
     * Lat: 24.4°N to 26.2°N
     * Lng: 50.7°E to 51.7°E
     */
    static isValidQatarCoordinate(lat: number, lng: number): boolean {
        const QATAR_LAT_MIN = 24.4;
        const QATAR_LAT_MAX = 26.2;
        const QATAR_LNG_MIN = 50.7;
        const QATAR_LNG_MAX = 51.7;
        
        return (
            lat >= QATAR_LAT_MIN &&
            lat <= QATAR_LAT_MAX &&
            lng >= QATAR_LNG_MIN &&
            lng <= QATAR_LNG_MAX
        );
    }
}

// Export singleton instance for easy use
export const fleetPricingService = new FleetPricingService();

export default fleetPricingService;
