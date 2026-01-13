/**
 * Exponential Backoff Retry Utility
 * Provides retry logic with configurable delays for API calls
 */

export interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000,    // 10 seconds max
    backoffMultiplier: 2,
};

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable (network errors, 5xx server errors)
 * Don't retry on 4xx client errors
 */
const isRetryableError = (error: Error): boolean => {
    const message = error.message.toLowerCase();
    // Network errors - always retry
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
        return true;
    }
    // Server errors (5xx) - retry
    if (message.includes('server error') || message.includes('500') || message.includes('502') || message.includes('503')) {
        return true;
    }
    // Client errors (4xx) - don't retry
    return false;
};

/**
 * Execute a function with exponential backoff retry
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Result of the function
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const { maxRetries, initialDelay, maxDelay, backoffMultiplier, retryableErrors } = finalConfig;

    let lastError: Error = new Error('Unknown error');
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            const shouldRetry = retryableErrors
                ? retryableErrors(lastError)
                : isRetryableError(lastError);

            // If not retryable or last attempt, throw immediately
            if (!shouldRetry || attempt >= maxRetries) {
                throw lastError;
            }

            console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);
            console.log(`[Retry] Retrying in ${delay}ms...`);

            await sleep(delay);

            // Calculate next delay with exponential backoff
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    throw lastError;
}

/**
 * Hook version of retry for React components
 */
export function useRetry() {
    return {
        withRetry,
        isRetryableError,
    };
}

export default useRetry;
