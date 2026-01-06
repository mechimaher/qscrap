// QScrap Driver App - ETA Service
// Premium ETA calculation using Haversine distance and average speed
// VVIP cutting-edge feature for customer transparency

// Average speeds for Qatar urban driving (km/h)
const AVG_SPEED_KMH = {
    peak: 20,     // Peak hours: 7-9 AM, 4-7 PM
    normal: 30,   // Normal traffic
    light: 40,    // Light traffic (late night)
};

// Buffer time for pickup/handoff (minutes)
const BUFFER_MINUTES = {
    pickup: 3,    // Time to park and collect part
    delivery: 2,  // Time to park and hand over
};

export interface ETAResult {
    eta: Date;
    durationMinutes: number;
    distanceKm: number;
    formattedETA: string;
    countdownText: string;
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Determine current traffic condition based on time
 */
function getTrafficCondition(): 'peak' | 'normal' | 'light' {
    const hour = new Date().getHours();
    const day = new Date().getDay();

    // Friday is weekend in Qatar, lighter traffic
    const isFriday = day === 5;

    // Peak hours
    if (!isFriday) {
        if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
            return 'peak';
        }
    }

    // Light traffic (late night/early morning)
    if (hour >= 22 || hour <= 5) {
        return 'light';
    }

    return 'normal';
}

/**
 * Calculate ETA from current location to destination
 */
export function calculateETA(
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number,
    includeBuffer: 'pickup' | 'delivery' | 'none' = 'none'
): ETAResult {
    const distanceKm = calculateDistance(currentLat, currentLng, destLat, destLng);

    // Get current traffic speed
    const trafficCondition = getTrafficCondition();
    const speedKmh = AVG_SPEED_KMH[trafficCondition];

    // Calculate travel time in minutes
    let durationMinutes = (distanceKm / speedKmh) * 60;

    // Add buffer time if applicable
    if (includeBuffer === 'pickup') {
        durationMinutes += BUFFER_MINUTES.pickup;
    } else if (includeBuffer === 'delivery') {
        durationMinutes += BUFFER_MINUTES.delivery;
    }

    // Round up
    durationMinutes = Math.ceil(durationMinutes);

    // Minimum 1 minute
    if (durationMinutes < 1) durationMinutes = 1;

    // Calculate ETA timestamp
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + durationMinutes);

    return {
        eta,
        durationMinutes,
        distanceKm: Math.round(distanceKm * 10) / 10,
        formattedETA: formatTime(eta),
        countdownText: formatCountdown(durationMinutes),
    };
}

/**
 * Format time as "3:45 PM"
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Format countdown text
 */
export function formatCountdown(minutes: number): string {
    if (minutes < 1) return 'Arriving now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

/**
 * Get ETA badge color based on remaining time
 */
export function getETAColor(minutes: number): string {
    if (minutes <= 5) return '#10b981';  // Green - arriving soon
    if (minutes <= 15) return '#f59e0b'; // Amber - moderate
    return '#6b7280';                     // Gray - normal
}

/**
 * Calculate full trip ETA (pickup + delivery)
 */
export function calculateTripETA(
    driverLat: number,
    driverLng: number,
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number
): {
    toPickup: ETAResult;
    toDelivery: ETAResult;
    totalMinutes: number;
} {
    const toPickup = calculateETA(driverLat, driverLng, pickupLat, pickupLng, 'pickup');
    const toDelivery = calculateETA(pickupLat, pickupLng, deliveryLat, deliveryLng, 'delivery');

    return {
        toPickup,
        toDelivery,
        totalMinutes: toPickup.durationMinutes + toDelivery.durationMinutes,
    };
}
