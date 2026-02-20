/**
 * VIN Service
 * simplified to handle VIN as a basic 17-character string.
 */

export class VINService {
    /**
     * Basic VIN format validation.
     * Enforces 17 alphanumeric characters, excluding I, O, Q.
     */
    isValid(vin: string): boolean {
        if (!vin) return false;
        const cleaned = vin.trim().toUpperCase();
        return cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
    }
}

export const vinService = new VINService();
