/**
 * Retry with Exponential Backoff
 * Wraps external API calls with automatic retry logic
 */

import logger from './logger';

interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 300,
        maxDelayMs = 10000,
        label = 'operation'
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxAttempts) {
                // Exponential backoff with jitter
                const delay = Math.min(
                    baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
                    maxDelayMs
                );

                logger.warn(`${label} failed, retrying in ${Math.round(delay)}ms`, {
                    attempt,
                    maxAttempts,
                    error: error instanceof Error ? error.message : String(error)
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
