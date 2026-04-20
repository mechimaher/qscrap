"use strict";
/**
 * QScrap Fleet Delivery Pricing Service
 *
 * Enterprise-grade delivery fee calculation compliant with Qatar Ministry of Commerce regulations.
 * Implements category-driven fleet assignment with vehicle-specific pricing.
 *
 * @author QScrap Engineering Team
 * @version 2.0 - Qatar MOCI Compliant
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetPricingService = exports.FleetPricingService = exports.QatarZoneSurcharges = exports.QatarVehiclePricing = exports.PartCategoryVehicleMap = exports.VehicleType = void 0;
// ============================================
// QATAR FLEET VEHICLE TYPES
// ============================================
var VehicleType;
(function (VehicleType) {
    VehicleType["MOTORCYCLE"] = "motorcycle";
    VehicleType["SMALL_VAN"] = "small_van";
    VehicleType["FLATBED_TRUCK"] = "flatbed_truck"; // Heavy parts (engines, transmissions)
})(VehicleType || (exports.VehicleType = VehicleType = {}));
// ============================================
// PART CATEGORIES TO VEHICLE MAPPING
// Based on Qatar MOCI cargo safety regulations
// ============================================
exports.PartCategoryVehicleMap = {
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
exports.QatarVehiclePricing = {
    [VehicleType.MOTORCYCLE]: {
        baseFare: 5, // 5 QAR base fare
        perKmRate: 1, // 1 QAR/km
        minFee: 5 // Minimum 5 QAR
    },
    [VehicleType.SMALL_VAN]: {
        baseFare: 15, // 15 QAR base fare
        perKmRate: 2, // 2 QAR/km
        minFee: 15 // Minimum 15 QAR
    },
    [VehicleType.FLATBED_TRUCK]: {
        baseFare: 50, // 50 QAR base fare
        perKmRate: 4, // 4 QAR/km
        minFee: 50 // Minimum 50 QAR
    }
};
// ============================================
// QATAR ZONE Surcharges (MOCI Compliance)
// Additional fees for specific industrial/special zones
// ============================================
exports.QatarZoneSurcharges = {
    'industrial_area': 10, // Mesaieed Industrial Area
    'doha_port': 15, // Doha Port (customs zone)
    'al_khor': 10, // Northern Qatar (Al Khor)
    'dukhan': 15, // Western Qatar (Dukhan)
    'salwa_border': 5, // Salwa Road (border area)
    'airport_zone': 10 // Hamad International Airport cargo zone
};
// ============================================
// DELIVERY FEE CALCULATION SERVICE
// ============================================
class FleetPricingService {
    /**
     * Determine required vehicle type based on part category
     * Falls back to SMALL_VAN if category unknown
     */
    static getRequiredVehicle(partCategory) {
        if (!partCategory) {
            return VehicleType.SMALL_VAN; // Default for unknown categories
        }
        const normalizedCategory = partCategory.toLowerCase().trim();
        return exports.PartCategoryVehicleMap[normalizedCategory] || VehicleType.SMALL_VAN;
    }
    /**
     * Calculate delivery fee using Qatar-specific pricing
     * Formula: Fee = Base Fare + (Rate per KM × Distance) + Zone Surcharge
     * Result is rounded to whole QAR
     */
    static calculateDeliveryFee(distanceKm, vehicleType, zoneSurcharge) {
        const pricing = exports.QatarVehiclePricing[vehicleType];
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
    static calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
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
    static toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    /**
     * Get pricing breakdown for transparency (for UI display)
     */
    static getPricingBreakdown(distanceKm, vehicleType, zoneSurcharge) {
        const pricing = exports.QatarVehiclePricing[vehicleType];
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
    static isValidQatarCoordinate(lat, lng) {
        const QATAR_LAT_MIN = 24.4;
        const QATAR_LAT_MAX = 26.2;
        const QATAR_LNG_MIN = 50.7;
        const QATAR_LNG_MAX = 51.7;
        return (lat >= QATAR_LAT_MIN &&
            lat <= QATAR_LAT_MAX &&
            lng >= QATAR_LNG_MIN &&
            lng <= QATAR_LNG_MAX);
    }
}
exports.FleetPricingService = FleetPricingService;
// Export singleton instance for easy use
exports.fleetPricingService = new FleetPricingService();
exports.default = exports.fleetPricingService;
