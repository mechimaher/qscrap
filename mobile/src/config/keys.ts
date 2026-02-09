/**
 * QScrap Mobile - API Keys Configuration
 * 
 * Centralized management for all third-party API keys.
 * Uses Expo environment variables (EXPO_PUBLIC_ prefix) from .env file.
 * 
 * Configure in .env file (not committed to git) or via Expo EAS Secrets.
 */

/**
 * Centralized API keys configuration
 * 
 * Expo inlines EXPO_PUBLIC_ vars at build time via babel transform.
 * 
 * @example
 * import { KEYS } from '../config/keys';
 * const apiKey = KEYS.GOOGLE_MAPS_API_KEY;
 */
export const KEYS = {
    /**
     * Google Maps API Key
     * Used for: geocoding, places autocomplete, directions
     * Configure via: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env
     */
    GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',

    /**
     * Stripe Publishable Key
     * Used for: payment processing
     * Configure via: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env
     * Note: Use test key (pk_test_) for development, live key (pk_live_) for production
     */
    STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
} as const;
